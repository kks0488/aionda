const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function normalizeHost(rawHost?: string | null): string {
  if (!rawHost) return '';
  const trimmed = rawHost.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']');
    if (end !== -1) {
      return trimmed.slice(1, end);
    }
  }
  return trimmed.split(':')[0] || '';
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return null;
  }
  return nums;
}

function isPrivateIpv4(host: string): boolean {
  const nums = parseIpv4(host);
  if (!nums) return false;
  const [a, b] = nums;

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

function isPrivateIpv6(host: string): boolean {
  if (host === '::1') return true;
  if (host.startsWith('fc') || host.startsWith('fd')) return true;
  if (host.startsWith('fe80')) return true;
  return false;
}

export function isLocalHost(hostname?: string | null): boolean {
  const normalized = normalizeHost(hostname);
  if (!normalized) return false;
  if (LOCAL_HOSTNAMES.has(normalized) || normalized.endsWith('.local')) return true;
  if (isPrivateIpv4(normalized) || isPrivateIpv6(normalized)) return true;
  return false;
}

export function isLocalOnlyEnabled(): boolean {
  return process.env.ADMIN_LOCAL_ONLY !== 'false';
}
