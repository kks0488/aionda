import { codeToHtml } from 'shiki';
import { CodeCopyButton } from './CodeCopyButton';

interface CodeBlockProps {
  code: string;
  language?: string;
}

const SHIKI_THEMES = {
  light: 'github-light',
  dark: 'github-dark',
} as const;

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function highlightCode(code: string, language: string): Promise<string> {
  try {
    return await codeToHtml(code, {
      lang: language,
      themes: SHIKI_THEMES,
    });
  } catch {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
}

export async function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const text = code.trim();
  const highlightedHtml = await highlightCode(text, language);

  return (
    <div className="relative group my-6">
      {language && language !== 'text' && (
        <div className="absolute top-0 left-4 z-10 px-2 py-1 text-xs font-mono text-muted-foreground bg-zinc-800 rounded-b">
          {language}
        </div>
      )}

      <CodeCopyButton code={text} />

      <div
        className="rounded-lg overflow-hidden [&_.shiki]:m-0 [&_.shiki]:p-4 [&_.shiki]:pt-8 [&_.shiki]:overflow-x-auto [&_.shiki]:text-sm [&_.shiki]:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    </div>
  );
}
