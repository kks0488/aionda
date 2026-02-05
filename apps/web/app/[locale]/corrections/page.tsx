import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';
import { BASE_URL } from '@/lib/site';

function cleanPrefill(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 500);
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return '';
  return trimmed.slice(0, 800);
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const isKo = locale === 'ko';
  return {
    title: isKo ? '정정/오류 제보 | AI온다' : 'Corrections | Aionda',
    description: isKo
      ? 'AI온다 글의 오류 제보/정정 요청 방법과 처리 원칙을 안내합니다.'
      : 'How to report corrections and errors for Aionda posts.',
    alternates: {
      canonical: `${BASE_URL}/${locale}/corrections`,
      languages: {
        en: `${BASE_URL}/en/corrections`,
        ko: `${BASE_URL}/ko/corrections`,
      },
    },
  };
}

export default async function CorrectionsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { url?: string; title?: string };
}) {
  setRequestLocale(locale);
  const isKo = locale === 'ko';

  const prefillUrl = normalizeUrl(cleanPrefill(searchParams?.url));
  const prefillTitle = cleanPrefill(searchParams?.title);

  const subject = isKo
    ? `정정 요청: ${prefillTitle || 'AI온다 글'}`
    : `Correction: ${prefillTitle || 'Aionda post'}`;
  const body = isKo
    ? [
        `URL: ${prefillUrl || '(여기에 링크를 붙여주세요)'}`,
        '',
        '어떤 부분이 잘못되었나요?',
        '- 위치: (예: 섹션/문장/스크린샷)',
        '- 문제: (왜 잘못되었는지)',
        '- 근거: (공식 문서/링크 등)',
        '',
        '원하시면 연락 가능한 이메일/계정 정보를 함께 남겨주세요.',
      ].join('\n')
    : [
        `URL: ${prefillUrl || '(paste the link here)'}`,
        '',
        'What is incorrect?',
        '- Location: (section/sentence/screenshot)',
        '- Issue: (what is wrong and why)',
        '- Evidence: (official docs/links)',
        '',
        'If needed, include a contact email.',
      ].join('\n');

  const mailto = `mailto:kks0488@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="bg-white dark:bg-[#101922] min-h-screen">
      <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
            {isKo ? '정정/오류 제보' : 'Corrections'}
          </h1>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {isKo
              ? '오류는 성장의 재료입니다. 잘못된 부분을 발견하시면 근거와 함께 알려주세요.'
              : 'Corrections help us improve. If you spot an error, please report it with evidence.'}
          </p>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {isKo ? '최종 업데이트' : 'Last updated'}: 2026-02-05
          </p>
        </div>
      </section>

      <main className="w-full max-w-3xl mx-auto px-6 py-12">
        <div className="prose prose-lg dark:prose-invert space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">
              {isKo ? '제보 방법' : 'How to Report'}
            </h2>
            <ul className="space-y-2 text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>{isKo ? '문제가 있는 글의 URL' : 'The URL of the post'}</li>
              <li>{isKo ? '어떤 부분이 왜 잘못되었는지' : 'What is wrong and why'}</li>
              <li>{isKo ? '가능하다면 1차/신뢰 출처 링크' : 'Links to primary/trusted sources (if possible)'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">
              {isKo ? '정정 처리' : 'What Happens Next'}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {isKo
                ? '확인 가능한 오류는 본문을 수정하고, 필요하면 검토일(lastReviewedAt)을 갱신합니다. 출처가 불충분하면 추가 확인이 필요하다고 표시할 수 있습니다.'
                : 'When we can validate an issue, we update the post and may bump the review date (lastReviewedAt). If evidence is insufficient, we may mark it as needing further verification.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">
              {isKo ? '이메일로 보내기' : 'Send Email'}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {isKo
                ? '아래 버튼을 누르면 템플릿이 자동으로 채워진 이메일이 열립니다.'
                : 'Click the button below to open an email with a pre-filled template.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={mailto}
                className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white hover:opacity-95 transition-opacity"
              >
                {isKo ? '정정 제보 메일 열기' : 'Open correction email'}
              </a>
              <Link
                href={`/${locale}/editorial`}
                className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-2.5 text-sm font-bold text-slate-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                {isKo ? '에디토리얼 정책 보기' : 'View editorial policy'}
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

