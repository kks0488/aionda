// Tag utilities for consistent styling across components

const TAG_COLORS = [
  'from-blue-500 to-cyan-400',
  'from-purple-500 to-pink-400',
  'from-green-500 to-emerald-400',
  'from-orange-500 to-amber-400',
  'from-red-500 to-rose-400',
  'from-indigo-500 to-violet-400',
];

const TAG_ICONS: Record<string, string> = {
  news: 'newspaper',
  opinion: 'lightbulb',
  openai: 'smart_toy',
  anthropic: 'psychology',
  grok: 'auto_awesome',
  xai: 'rocket_launch',
  gpt: 'chat',
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
