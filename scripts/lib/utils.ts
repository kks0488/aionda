import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * 디렉토리가 존재하지 않으면 생성
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 디렉토리에서 JSON 파일 목록 가져오기
 */
export function getJsonFiles(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }
  return readdirSync(dirPath).filter((f) => f.endsWith('.json'));
}

/**
 * JSON 파일 안전하게 파싱 (에러 시 null 반환)
 */
export function safeParseJson<T>(filePath: string): T | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Failed to parse JSON: ${filePath}`, error);
    return null;
  }
}

/**
 * 제목에서 URL 슬러그 생성
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60)
    .replace(/-$/, '')
    .replace(/^-/, '');
}

/**
 * CLI 인자에서 특정 값 추출 (예: --id=123)
 */
export function getCliArg(argName: string): string | undefined {
  const args = process.argv.slice(2);
  const arg = args.find((a) => a.startsWith(`--${argName}=`));
  return arg ? arg.split('=')[1] : undefined;
}

/**
 * 양수 정수 파싱 (유효하지 않으면 기본값 반환)
 */
export function parsePositiveInt(
  value: string | undefined,
  defaultValue: number,
  max: number = Infinity
): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) return defaultValue;
  return Math.min(parsed, max);
}
