type JsonKind = 'object' | 'array';

function isExpectedJson(value: unknown, kind: JsonKind): boolean {
  if (kind === 'array') return Array.isArray(value);
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canParseAsKind(candidate: string, kind: JsonKind): boolean {
  try {
    const parsed = JSON.parse(candidate);
    return isExpectedJson(parsed, kind);
  } catch {
    return false;
  }
}

function findBalancedFromIndex(text: string, start: number, openChar: string, closeChar: string): string | null {
  if (start < 0 || start >= text.length || text[start] !== openChar) return null;

  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = '';
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }

    if (ch === openChar) {
      depth += 1;
      continue;
    }

    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function extractBalancedJson(text: string, kind: JsonKind): string | null {
  const openChar = kind === 'object' ? '{' : '[';
  const closeChar = kind === 'object' ? '}' : ']';

  let index = text.indexOf(openChar);
  while (index !== -1) {
    const candidate = findBalancedFromIndex(text, index, openChar, closeChar);
    if (candidate && canParseAsKind(candidate, kind)) {
      return candidate;
    }
    index = text.indexOf(openChar, index + 1);
  }

  return null;
}

function extractFromCodeFences(text: string, kind: JsonKind): string | null {
  const fenceRegex = /```[^\n]*\n([\s\S]*?)```/g;

  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text)) !== null) {
    const fenced = String(match[1] || '');
    const extracted = extractBalancedJson(fenced, kind);
    if (extracted) return extracted;
  }

  return null;
}

export function extractJsonObject(text: string): string | null {
  const source = String(text || '');
  return extractFromCodeFences(source, 'object') || extractBalancedJson(source, 'object');
}

export function extractJsonArray(text: string): string | null {
  const source = String(text || '');
  return extractFromCodeFences(source, 'array') || extractBalancedJson(source, 'array');
}
