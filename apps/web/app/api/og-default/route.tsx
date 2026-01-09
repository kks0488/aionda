import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <span
            style={{
              color: '#a78bfa',
              fontSize: 96,
              fontWeight: 'bold',
            }}
          >
            AI온다
          </span>
          <span
            style={{
              color: '#94a3b8',
              fontSize: 36,
            }}
          >
            AI가 온다 | AI is Coming
          </span>
          <span
            style={{
              color: '#64748b',
              fontSize: 24,
              marginTop: 20,
            }}
          >
            aionda.blog
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
