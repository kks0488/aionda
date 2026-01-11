"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n';

type PostSummary = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  coverImage?: string;
  verificationScore?: number;
  sourceUrl?: string;
  sourceId?: string;
};

type PostDetail = PostSummary & {
  content: string;
};

const STORAGE_KEY = 'aionda-admin-api-key';
const LOCALES: Locale[] = ['en', 'ko'];

export default function AdminPanel({ locale }: { locale: Locale }) {
  const [apiKey, setApiKey] = useState('');
  const [activeLocale, setActiveLocale] = useState<Locale>(locale);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>('');
  const [editor, setEditor] = useState<PostDetail | null>(null);
  const [tagsInput, setTagsInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [publishStatus, setPublishStatus] = useState('');
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [canLocalWrite, setCanLocalWrite] = useState(false);

  useEffect(() => {
    const savedKey = window.localStorage.getItem(STORAGE_KEY);
    if (savedKey) setApiKey(savedKey);
  }, []);

  useEffect(() => {
    if (apiKey) {
      window.localStorage.setItem(STORAGE_KEY, apiKey);
    }
  }, [apiKey]);

  useEffect(() => {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');
    setCanLocalWrite(isLocalhost);
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    void loadPosts();
  }, [apiKey, activeLocale]);

  useEffect(() => {
    if (editor) {
      setTagsInput(editor.tags.join(', '));
      setPrTitle(`Admin update: ${editor.slug} (${activeLocale})`);
      setPrBody('Edited via Aionda admin panel.');
      setPrUrl('');
    }
  }, [editor?.slug, activeLocale]);

  const filteredPosts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return posts;
    return posts.filter((post) => {
      const tags = post.tags.join(' ').toLowerCase();
      return (
        post.title.toLowerCase().includes(term) ||
        post.slug.toLowerCase().includes(term) ||
        tags.includes(term)
      );
    });
  }, [posts, search]);

  const loadPosts = async () => {
    setLoadingList(true);
    setStatus('');
    try {
      const response = await fetch(`/api/admin/posts?locale=${activeLocale}`, {
        headers: { 'x-api-key': apiKey },
        cache: 'no-store',
      });
      if (!response.ok) {
        setStatus(response.status === 401 ? 'Unauthorized' : 'Failed to load posts');
        setPosts([]);
        return;
      }
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      setStatus('Failed to load posts');
    } finally {
      setLoadingList(false);
    }
  };

  const loadPost = async (slug: string) => {
    setLoadingDetail(true);
    setStatus('');
    setSelectedSlug(slug);
    try {
      const response = await fetch(`/api/admin/posts/${slug}?locale=${activeLocale}`, {
        headers: { 'x-api-key': apiKey },
        cache: 'no-store',
      });
      if (!response.ok) {
        setStatus(response.status === 401 ? 'Unauthorized' : 'Failed to load post');
        setEditor(null);
        return;
      }
      const data = await response.json();
      setEditor(data);
    } catch (error) {
      setStatus('Failed to load post');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSave = async () => {
    if (!editor) return;
    if (!canLocalWrite) {
      setStatus('Local save is disabled here. Use Create PR.');
      return;
    }
    setSaving(true);
    setStatus('');
    try {
      const nextTags = tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const payload = {
        title: editor.title,
        description: editor.description,
        date: editor.date,
        coverImage: editor.coverImage || '',
        tags: nextTags,
        content: editor.content,
      };
      const response = await fetch(`/api/admin/posts/${editor.slug}?locale=${activeLocale}`, {
        method: 'PUT',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setStatus(response.status === 401 ? 'Unauthorized' : 'Failed to save post');
        return;
      }

      setPosts((prev) =>
        prev.map((post) =>
          post.slug === editor.slug
            ? {
              ...post,
              title: editor.title,
              description: editor.description,
              date: editor.date,
              tags: nextTags,
              coverImage: editor.coverImage || '',
            }
            : post
        )
      );
      setStatus('Saved');
    } catch (error) {
      setStatus('Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!editor) return;
    setPublishing(true);
    setPublishStatus('');
    setPrUrl('');

    try {
      const nextTags = tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const payload = {
        slug: editor.slug,
        locale: activeLocale,
        title: editor.title,
        description: editor.description,
        date: editor.date,
        coverImage: editor.coverImage || '',
        tags: nextTags,
        content: editor.content,
        commitMessage: `Admin update: ${editor.slug} (${activeLocale})`,
        prTitle: prTitle.trim() || `Admin update: ${editor.slug} (${activeLocale})`,
        prBody: prBody.trim() || 'Edited via Aionda admin panel.',
      };

      const response = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setPublishStatus(response.status === 401 ? 'Unauthorized' : 'Failed to create PR');
        return;
      }

      const data = await response.json();
      setPublishStatus('PR created');
      if (data.prUrl) setPrUrl(data.prUrl);
    } catch (error) {
      setPublishStatus('Failed to create PR');
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!editor) return;
    const confirmed = window.confirm(`Delete ${editor.slug}? This creates a PR.`);
    if (!confirmed) return;

    setDeleting(true);
    setPublishStatus('');
    setPrUrl('');

    try {
      const payload = {
        slug: editor.slug,
        locale: activeLocale,
        action: 'delete',
        commitMessage: `Admin delete: ${editor.slug} (${activeLocale})`,
        prTitle: `Delete: ${editor.slug} (${activeLocale})`,
        prBody: 'Delete post via Aionda admin panel.',
      };

      const response = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setPublishStatus(response.status === 401 ? 'Unauthorized' : 'Failed to create delete PR');
        return;
      }

      const data = await response.json();
      setPublishStatus('Delete PR created');
      if (data.prUrl) setPrUrl(data.prUrl);
    } catch (error) {
      setPublishStatus('Failed to create delete PR');
    } finally {
      setDeleting(false);
    }
  };

  const handleEditorChange = (field: keyof PostDetail, value: string) => {
    if (!editor) return;
    setEditor({ ...editor, [field]: value });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Editor</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Edit published posts directly. Changes apply to markdown files.
            </p>
          </div>
          <Link
            href={`/${activeLocale}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            View site
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
          <aside className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-slate-900/50 p-4 shadow-sm">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Admin API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  placeholder="Enter key"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={activeLocale}
                  onChange={(event) => setActiveLocale(event.target.value as Locale)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  {LOCALES.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc.toUpperCase()}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={loadPosts}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800"
                  disabled={loadingList || !apiKey}
                >
                  {loadingList ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              <div>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  placeholder="Search by title, slug, tag"
                />
              </div>

              {status && (
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                  {status}
                </div>
              )}
              {publishStatus && (
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                  {publishStatus}
                </div>
              )}
              {prUrl && (
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View PR
                </a>
              )}
            </div>

            <div className="mt-4 space-y-2 max-h-[560px] overflow-y-auto pr-2">
              {filteredPosts.length === 0 && (
                <div className="text-sm text-slate-500">No posts found.</div>
              )}
              {filteredPosts.map((post) => (
                <button
                  key={post.slug}
                  type="button"
                  onClick={() => loadPost(post.slug)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                    post.slug === selectedSlug
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
                    {post.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{post.slug}</div>
                  <div className="text-xs text-slate-400 mt-1">{post.date}</div>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-slate-900/50 p-6 shadow-sm">
            {!editor && (
              <div className="text-sm text-slate-500">
                {loadingDetail ? 'Loading...' : 'Select a post to edit.'}
              </div>
            )}

            {editor && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <div>
                    <div className="text-xs uppercase text-slate-500">Editing</div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-white">
                      {editor.slug}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/${activeLocale}/posts/${editor.slug}`}
                      className="text-sm font-semibold text-primary hover:underline"
                      target="_blank"
                    >
                      Preview
                    </Link>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                      disabled={saving || !canLocalWrite}
                      title={canLocalWrite ? 'Save local file' : 'Local save works only on localhost'}
                    >
                      {saving ? 'Saving...' : 'Save Local'}
                    </button>
                    <button
                      type="button"
                      onClick={handlePublish}
                      className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
                      disabled={publishing || !apiKey}
                    >
                      {publishing ? 'Creating PR...' : 'Create PR'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="rounded-lg border border-rose-500 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-60"
                      disabled={deleting || !apiKey}
                    >
                      {deleting ? 'Creating PR...' : 'Delete PR'}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Title</label>
                    <input
                      type="text"
                      value={editor.title}
                      onChange={(event) => handleEditorChange('title', event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Date</label>
                    <input
                      type="text"
                      value={editor.date}
                      onChange={(event) => handleEditorChange('date', event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">PR Title</label>
                    <input
                      type="text"
                      value={prTitle}
                      onChange={(event) => setPrTitle(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">PR Body</label>
                    <input
                      type="text"
                      value={prBody}
                      onChange={(event) => setPrBody(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Description</label>
                  <textarea
                    value={editor.description}
                    onChange={(event) => handleEditorChange('description', event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Tags</label>
                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(event) => setTagsInput(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                      placeholder="news, llm, openai"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Cover Image</label>
                    <input
                      type="text"
                      value={editor.coverImage || ''}
                      onChange={(event) => handleEditorChange('coverImage', event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                      placeholder="/images/posts/slug.jpeg"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Leave empty to use slug-based images or placeholder.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Content</label>
                  <textarea
                    value={editor.content}
                    onChange={(event) => handleEditorChange('content', event.target.value)}
                    rows={18}
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid gap-2 text-xs text-slate-500">
                  <div>Source ID: {editor.sourceId || 'n/a'}</div>
                  <div>Source URL: {editor.sourceUrl || 'n/a'}</div>
                  <div>
                    Verification: {editor.verificationScore !== undefined ? `${Math.round(editor.verificationScore * 100)}%` : 'n/a'}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
