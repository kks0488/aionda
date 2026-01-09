'use client';

import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const [html, setHtml] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const highlight = async () => {
      try {
        const highlighted = await codeToHtml(code.trim(), {
          lang: language,
          theme: 'github-dark',
        });
        setHtml(highlighted);
      } catch {
        // Fallback for unsupported languages
        const escaped = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        setHtml(`<pre class="shiki"><code>${escaped}</code></pre>`);
      }
    };
    highlight();
  }, [code, language]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-6">
      {/* Language badge */}
      {language && language !== 'text' && (
        <div className="absolute top-0 left-4 px-2 py-1 text-xs font-mono text-muted-foreground bg-zinc-800 rounded-b">
          {language}
        </div>
      )}

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-xs font-mono text-muted-foreground bg-zinc-700 hover:bg-zinc-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>

      {/* Code content */}
      {html ? (
        <div
          className="rounded-lg overflow-hidden [&>pre]:p-4 [&>pre]:pt-8 [&>pre]:overflow-x-auto [&>pre]:text-sm [&>pre]:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="bg-zinc-900 rounded-lg p-4 pt-8 overflow-x-auto text-sm leading-relaxed">
          <code className="text-zinc-300">{code}</code>
        </pre>
      )}
    </div>
  );
}
