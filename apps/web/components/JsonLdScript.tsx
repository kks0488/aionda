import { headers } from 'next/headers';
import { safeJsonLd } from '@/lib/json-ld';

export default function JsonLdScript({ id, data }: { id: string; data: unknown }) {
  const nonce = headers().get('x-nonce') || undefined;

  return (
    <script
      id={id}
      nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
