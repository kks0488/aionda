'use client';

import { useState } from 'react';

interface CodeCopyButtonProps {
  code: string;
}

export function CodeCopyButton({ code }: CodeCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (!code) return;

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!success) {
          throw new Error('Copy failed');
        }
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 z-10 px-2 py-1 text-xs font-mono text-muted-foreground bg-zinc-700 hover:bg-zinc-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
