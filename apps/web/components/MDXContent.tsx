'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import { toHeadingId } from '@/lib/heading-utils';
import { sanitizeHref } from '@/lib/url-safe';

interface MDXContentProps {
  source: string;
}

export function MDXContent({ source }: MDXContentProps) {
  return (
    <article className="mdx-content prose prose-zinc dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings with anchors
          h1: ({ children }) => {
            const id = toHeadingId(String(children));
            return (
              <h1 id={id} className="text-4xl font-bold tracking-tight mt-12 mb-6 scroll-mt-24">
                {children}
              </h1>
            );
          },
          h2: ({ children }) => {
            const id = toHeadingId(String(children));
            return (
              <h2
                id={id}
                className="text-2xl font-semibold tracking-tight mt-12 mb-4 pb-2 border-b border-border scroll-mt-24"
              >
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const id = toHeadingId(String(children));
            return (
              <h3 id={id} className="text-xl font-semibold mt-8 mb-4 scroll-mt-24">
                {children}
              </h3>
            );
          },
          h4: ({ children }) => (
            <h4 className="text-lg font-semibold mt-6 mb-3">{children}</h4>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="mb-6 leading-relaxed text-slate-700 dark:text-slate-300">{children}</p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc pl-6 mb-6 space-y-2 marker:text-slate-400 dark:marker:text-slate-500">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-6 space-y-2 marker:text-slate-400 dark:marker:text-slate-500">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-2">{children}</li>
          ),

          // Links
          a: ({ href, children }) => {
            const safeHref = sanitizeHref(href);
            if (!safeHref) return <>{children}</>;

            const isExternalHttp = safeHref.startsWith('http://') || safeHref.startsWith('https://');
            return (
              <a
                href={safeHref}
                target={isExternalHttp ? '_blank' : undefined}
                rel={isExternalHttp ? 'noopener noreferrer' : undefined}
                className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent transition-colors"
              >
                {children}
              </a>
            );
          },

          // Blockquotes - styled as pull quotes
          blockquote: ({ children }) => (
            <blockquote className="relative my-8 pl-6 border-l-4 border-primary italic text-lg text-slate-600 dark:text-slate-400">
              <span className="absolute -left-3 -top-2 text-5xl text-accent/20 font-serif">
                &ldquo;
              </span>
              {children}
            </blockquote>
          ),

          // Code blocks with Shiki
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;

            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-sm font-mono text-primary">
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                code={String(children)}
                language={match[1]}
              />
            );
          },
          pre: ({ children }) => <>{children}</>,

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-8 rounded-lg border border-border">
              <table className="min-w-full divide-y divide-border">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 dark:bg-slate-800">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border">{children}</tbody>
          ),
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-sm font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm">{children}</td>
          ),

          // Horizontal rule
          hr: () => (
            <hr className="my-12 border-t border-border" />
          ),

          // Images
          img: ({ src, alt }) => (
            <figure className="my-8">
              <img
                src={src}
                alt={alt || ''}
                className="rounded-lg w-full"
                loading="lazy"
              />
              {alt && (
                <figcaption className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
                  {alt}
                </figcaption>
              )}
            </figure>
          ),

          // Strong and emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),

          // Strikethrough
          del: ({ children }) => (
            <del className="text-slate-500 dark:text-slate-400 line-through">{children}</del>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </article>
  );
}
