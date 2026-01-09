import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const title = searchParams.get('title') || 'AI온다 - AI가 온다';
  const date = searchParams.get('date') || '';
  const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
  const score = searchParams.get('score');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
          padding: 60,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                color: '#a78bfa',
                fontSize: 32,
                fontWeight: 'bold',
              }}
            >
              AI온다
            </span>
            <span
              style={{
                color: '#64748b',
                fontSize: 24,
              }}
            >
              aionda.blog
            </span>
          </div>
          {score && (
            <span
              style={{
                backgroundColor: Number(score) >= 70 ? '#22c55e' : '#f59e0b',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 20,
              }}
            >
              {score}% Verified
            </span>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <h1
            style={{
              color: 'white',
              fontSize: title.length > 50 ? 48 : 64,
              fontWeight: 'bold',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {title}
          </h1>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                style={{
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 18,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
          {date && (
            <span
              style={{
                color: '#94a3b8',
                fontSize: 20,
              }}
            >
              {date}
            </span>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
