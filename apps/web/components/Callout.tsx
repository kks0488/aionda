'use client';

import { ReactNode } from 'react';

type CalloutType = 'info' | 'warning' | 'tip' | 'error';

interface CalloutProps {
  type: CalloutType;
  children: ReactNode;
  title?: string;
}

const icons: Record<CalloutType, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  tip: '💡',
  error: '🚫',
};

const titles: Record<CalloutType, string> = {
  info: 'Info',
  warning: 'Warning',
  tip: 'Tip',
  error: 'Error',
};

const styles: Record<CalloutType, string> = {
  info: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  warning: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  tip: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
  error: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
};

export function Callout({ type, children, title }: CalloutProps) {
  return (
    <div className={`callout rounded-lg border-l-4 p-4 my-6 ${styles[type]}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">{icons[type]}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-1">
            {title || titles[type]}
          </p>
          <div className="text-sm text-muted-foreground [&>p]:mb-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to parse callout syntax from markdown
// Syntax: :::info{title="Custom Title"}\nContent\n:::
export function parseCallout(text: string): { type: CalloutType; title?: string; content: string } | null {
  const match = text.match(/^:::(info|warning|tip|error)(?:\{title="([^"]+)"\})?\n([\s\S]*?)\n:::$/);
  if (match) {
    return {
      type: match[1] as CalloutType,
      title: match[2],
      content: match[3],
    };
  }
  return null;
}
