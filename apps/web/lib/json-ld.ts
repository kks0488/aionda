export function safeJsonLd(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) return 'null';

  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
