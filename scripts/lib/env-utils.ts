export function parseIntEnv(name: string, defaultVal: number, min = 0): number {
  const raw = process.env[name];
  if (!raw) return defaultVal;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min) return defaultVal;
  return parsed;
}

export function parseFloatEnv(
  name: string,
  defaultVal: number,
  min = 0,
  max = Infinity
): number {
  const raw = process.env[name];
  if (!raw) return defaultVal;
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return defaultVal;
  return parsed;
}
