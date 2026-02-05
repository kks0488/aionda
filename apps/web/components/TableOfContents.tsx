'use client';

import { useEffect, useState } from 'react';
import { normalizeHeadingText, toHeadingId } from '@/lib/heading-utils';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  className?: string;
}

export function TableOfContents({ content, className }: TableOfContentsProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  // Parse headings from markdown content
  useEffect(() => {
    const headingRegex = /^(#{2,3})\s+(.+)$/gm;
    const headings: TocItem[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const rawText = match[2];
      const text = normalizeHeadingText(rawText);
      const id = toHeadingId(rawText);
      if (!text || !id) continue;
      headings.push({ id, text, level });
    }

    setItems(headings);
  }, [content]);

  // Track active heading on scroll
  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    items.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  return (
    <nav
      className={`hidden xl:block sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30 p-5 ${className || ''}`}
      aria-label="Table of contents"
    >
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
        On this page
      </h4>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li
            key={item.id}
            style={{ paddingLeft: `${(item.level - 2) * 12}px` }}
          >
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById(item.id);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                  history.pushState(null, '', `#${item.id}`);
                }
              }}
              className={`block py-1 transition-colors hover:text-slate-900 dark:hover:text-white ${
                activeId === item.id
                  ? 'text-primary font-medium border-l-2 border-primary -ml-2 pl-2'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
