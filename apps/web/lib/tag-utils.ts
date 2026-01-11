// Tag utilities for consistent styling across components

// Colors that work well in both light and dark modes
// Using darker base colors (600-700) that are visible on light backgrounds
const TAG_COLORS = [
  'from-blue-600 to-cyan-500 dark:from-blue-500 dark:to-cyan-400',
  'from-purple-600 to-pink-500 dark:from-purple-500 dark:to-pink-400',
  'from-green-600 to-emerald-500 dark:from-green-500 dark:to-emerald-400',
  'from-orange-600 to-amber-500 dark:from-orange-500 dark:to-amber-400',
  'from-red-600 to-rose-500 dark:from-red-500 dark:to-rose-400',
  'from-indigo-600 to-violet-500 dark:from-indigo-500 dark:to-violet-400',
];

const TAG_ICONS: Record<string, string> = {
  news: 'newspaper',
  opinion: 'lightbulb',
  openai: 'smart_toy',
  anthropic: 'psychology',
  grok: 'auto_awesome',
  xai: 'rocket_launch',
  gpt: 'chat',
  chatgpt: 'chat',
  gemini: 'stars',
  llama: 'pets',
  ai: 'memory',
  hardware: 'memory',
  agi: 'psychology',
  llm: 'chat',
  robotics: 'precision_manufacturing',
  'ai-tools': 'build',
  tutorial: 'school',
  research: 'science',
  default: 'article',
};

/**
 * Generate a consistent gradient color based on the tag name
 */
export function getTagColor(tag: string): string {
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TAG_COLORS[hash % TAG_COLORS.length];
}

/**
 * Get a Material Symbol icon name for a tag
 */
export function getTagIcon(tag: string): string {
  return TAG_ICONS[tag.toLowerCase()] || TAG_ICONS.default;
}
