import { NextRequest } from 'next/server';
import matter from 'gray-matter';

const GITHUB_API = 'https://api.github.com';

function requireAdmin(request: NextRequest): Response | null {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return Response.json({ error: 'Admin API key not configured' }, { status: 500 });
  }

  const provided = request.headers.get('x-api-key');
  if (provided !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function requireGithubEnv(): { owner: string; repo: string; base: string; token: string } | Response {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const base = process.env.GITHUB_DEFAULT_BRANCH || 'main';

  if (!owner || !repo || !token) {
    return Response.json({ error: 'GitHub settings missing' }, { status: 500 });
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
  const auth = requireAdmin(request);
  if (auth) return auth;

  const githubEnv = requireGithubEnv();
  if (githubEnv instanceof Response) return githubEnv;

  const payload = await request.json().catch(() => ({}));
  const slug = String(payload.slug || '').trim();
  const locale = String(payload.locale || '').trim();

  if (!slug || !locale) {
    return Response.json({ error: 'Missing slug or locale' }, { status: 400 });
  }

  const { owner, repo, token, base } = githubEnv;
  const fileInfo = await findPostPath(owner, repo, base, token, slug, locale);
  if (!fileInfo) {
    return Response.json({ error: 'Post file not found in repository' }, { status: 404 });
  }

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

  const branchSuffix = sanitizeBranchName(`${slug}-${locale}-${Date.now()}`);
  const branch = `admin/${branchSuffix}`;

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

  const prTitle = String(payload.prTitle || `Admin update: ${slug} (${locale})`).trim();
  const prBody = String(payload.prBody || 'Edited via Aionda admin panel.').trim();

  const pr = await githubRequest<{ html_url: string }>(
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

  return Response.json({ ok: true, prUrl: pr.html_url, branch });
}
