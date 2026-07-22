export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'http://localhost:8317/v1';
// gpt-5.6-sol is the current flagship target, but the local proxy can expose a
// model before an auth route is usable. gpt-5.5 is the highest quality tier
// verified end-to-end in this deployment as of 2026-07-23.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
