import { NextRequest } from 'next/server';
import matter from 'gray-matter';
import { isLocalHost, isLocalOnlyEnabled } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const GITHUB_API = 'https://api.github.com';
const GITHUB_GRAPHQL = 'https://api.github.com/graphql';
const AUTO_MERGE_ENABLED = process.env.GITHUB_AUTO_MERGE !== 'false';
const MERGE_METHOD = String(process.env.GITHUB_MERGE_METHOD || 'SQUASH').toUpperCase();
const PUBLISH_ENABLED = process.env.ADMIN_PUBLISH_ENABLED === 'true';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_LOCALES = new Set(['ko', 'en']);

const ADMIN_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

function adminJson(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: ADMIN_HEADERS });
}

function requireLocal(request: NextRequest): Response | null {
  if (!isLocalOnlyEnabled()) return null;

  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.hostname;

  if (!isLocalHost(host)) {
    return adminJson({ error: 'Not found' }, { status: 404 });
  }

  return null;
}

function requireAdmin(request: NextRequest): Response | null {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return adminJson({ error: 'Admin API key not configured' }, { status: 500 });
  }

  const provided = request.headers.get('x-api-key');
  if (provided !== expected) {
    return adminJson({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function requireGithubEnv(): { owner: string; repo: string; base: string; token: string } | Response {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const base = process.env.GITHUB_DEFAULT_BRANCH || 'main';

  if (!owner || !repo || !token) {
    return adminJson({ error: 'GitHub settings missing' }, { status: 500 });
  }

  return { owner, repo, token, base };
}

function sanitizeBranchName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

async function githubRequest<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub API ${response.status}: ${errorBody}`);
  }

  return (await response.json()) as T;
}

async function githubGraphqlRequest<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const response = await fetch(GITHUB_GRAPHQL, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub GraphQL ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (data.errors?.length) {
    throw new Error(data.errors.map((error) => error.message).join('; '));
  }

  if (!data.data) {
    throw new Error('GitHub GraphQL returned empty data');
  }

  return data.data;
}

function resolveMergeMethod(value: string): 'MERGE' | 'SQUASH' | 'REBASE' {
  if (value === 'MERGE' || value === 'REBASE' || value === 'SQUASH') {
    return value;
  }
  return 'SQUASH';
}

async function findPostPath(owner: string, repo: string, base: string, token: string, slug: string, locale: string) {
  const candidates = [
    `apps/web/content/posts/${locale}/${slug}.mdx`,
    `apps/web/content/posts/${locale}/${slug}.md`,
  ];

  for (const path of candidates) {
    try {
      const data = await githubRequest<{ sha: string; content: string }>(
        `/repos/${owner}/${repo}/contents/${path}?ref=${base}`,
        token
      );
      return { path, sha: data.sha, content: data.content };
    } catch (error) {
      continue;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const local = requireLocal(request);
  if (local) return local;

  const auth = requireAdmin(request);
  if (auth) return auth;

  if (!PUBLISH_ENABLED) {
    return adminJson({ error: 'Publish disabled' }, { status: 403 });
  }

  const githubEnv = requireGithubEnv();
  if (githubEnv instanceof Response) return githubEnv;

  const payload = await request.json().catch(() => ({}));
  const slug = String(payload.slug || '').trim();
  const locale = String(payload.locale || '').trim();
  const action = String(payload.action || 'update').trim().toLowerCase();

  if (!slug || !locale) {
    return adminJson({ error: 'Missing slug or locale' }, { status: 400 });
  }

  if (!SLUG_PATTERN.test(slug)) {
    return adminJson({ error: 'Invalid slug' }, { status: 400 });
  }

  if (!ALLOWED_LOCALES.has(locale)) {
    return adminJson({ error: 'Invalid locale' }, { status: 400 });
  }

  if (action !== 'update' && action !== 'delete') {
    return adminJson({ error: 'Invalid action' }, { status: 400 });
  }

  const { owner, repo, token, base } = githubEnv;

  try {
    const fileInfo = await findPostPath(owner, repo, base, token, slug, locale);
    if (!fileInfo) {
      return adminJson({ error: 'Post file not found in repository' }, { status: 404 });
    }

    const branchSuffix = sanitizeBranchName(`${slug}-${locale}-${Date.now()}`);
    const branch = action === 'delete' ? `admin/delete-${branchSuffix}` : `admin/${branchSuffix}`;

    const baseRef = await githubRequest<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${base}`,
      token
    );

    await githubRequest(
      `/repos/${owner}/${repo}/git/refs`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
      }
    );

    if (action === 'delete') {
      const commitMessage = String(payload.commitMessage || `Admin delete: ${slug} (${locale})`).trim();
      await githubRequest(
        `/repos/${owner}/${repo}/contents/${fileInfo.path}`,
        token,
        {
          method: 'DELETE',
          body: JSON.stringify({
            message: commitMessage,
            branch,
            sha: fileInfo.sha,
          }),
        }
      );
    } else {
      const decoded = Buffer.from(fileInfo.content, 'base64').toString('utf8');
      const { data, content } = matter(decoded);

      const nextData = { ...data };
      if (typeof payload.title === 'string') nextData.title = payload.title.trim();
      if (typeof payload.description === 'string') nextData.description = payload.description.trim();
      if (typeof payload.date === 'string') nextData.date = payload.date.trim();

      if (payload.tags !== undefined) {
        const tags = Array.isArray(payload.tags)
          ? payload.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
          : String(payload.tags)
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
        nextData.tags = tags;
      }

      if (typeof payload.coverImage === 'string') {
        const value = payload.coverImage.trim();
        if (value) {
          nextData.coverImage = value;
        } else {
          delete nextData.coverImage;
        }
      }

      const nextContent = typeof payload.content === 'string' ? payload.content : content;
      const updated = matter.stringify(nextContent, nextData);

      const commitMessage = String(payload.commitMessage || `Admin update: ${slug} (${locale})`).trim();

      await githubRequest(
        `/repos/${owner}/${repo}/contents/${fileInfo.path}`,
        token,
        {
          method: 'PUT',
          body: JSON.stringify({
            message: commitMessage,
            content: Buffer.from(updated, 'utf8').toString('base64'),
            branch,
            sha: fileInfo.sha,
          }),
        }
      );
    }

    const defaultTitle = action === 'delete'
      ? `Delete: ${slug} (${locale})`
      : `Admin update: ${slug} (${locale})`;
    const defaultBody = action === 'delete'
      ? 'Delete post via Aionda admin panel.'
      : 'Edited via Aionda admin panel.';

    const prTitle = String(payload.prTitle || defaultTitle).trim();
    const prBody = String(payload.prBody || defaultBody).trim();

    const pr = await githubRequest<{ html_url: string; node_id?: string }>(
      `/repos/${owner}/${repo}/pulls`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          title: prTitle,
          head: branch,
          base,
          body: prBody,
        }),
      }
    );

    const autoMerge = { attempted: false, enabled: false, message: '' };

    if (AUTO_MERGE_ENABLED && pr.node_id) {
      autoMerge.attempted = true;
      try {
        const mergeMethod = resolveMergeMethod(MERGE_METHOD);
        const mutation = `
          mutation EnableAutoMerge($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
            enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: $mergeMethod }) {
              pullRequest { number }
            }
          }
        `;
        await githubGraphqlRequest(
          token,
          mutation,
          { pullRequestId: pr.node_id, mergeMethod }
        );
        autoMerge.enabled = true;
      } catch (error: any) {
        autoMerge.message = error?.message || 'Auto-merge failed';
      }
    } else if (!AUTO_MERGE_ENABLED) {
      autoMerge.message = 'Auto-merge disabled';
    }

    return adminJson({ ok: true, prUrl: pr.html_url, branch, autoMerge });
  } catch (error: any) {
    return adminJson({ error: error?.message || 'GitHub API error' }, { status: 500 });
  }
}
