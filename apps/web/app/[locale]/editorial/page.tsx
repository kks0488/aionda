import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';
import { BASE_URL } from '@/lib/site';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const isKo = locale === 'ko';
  return {
    title: isKo ? '에디토리얼 정책 | AI온다' : 'Editorial Policy | Aionda',
    description: isKo
      ? 'AI온다(aionda.blog)의 에디토리얼 원칙과 검증/출처 정책을 설명합니다.'
      : 'Editorial principles, sourcing, and verification policy for Aionda (aionda.blog).',
    alternates: {
      canonical: `${BASE_URL}/${locale}/editorial`,
      languages: {
        en: `${BASE_URL}/en/editorial`,
        ko: `${BASE_URL}/ko/editorial`,
      },
    },
  };
}

export default async function EditorialPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const isKo = locale === 'ko';

  return (
    <div className="bg-white dark:bg-[#101922] min-h-screen">
      <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
            {isKo ? '에디토리얼 정책' : 'Editorial Policy'}
          </h1>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {isKo
              ? 'AI온다는 “커뮤니티 신호를 근거로 바꾸는” 실무형 AI 블로그를 지향합니다. 아래는 우리가 글을 만들고 관리하는 방식입니다.'
              : 'Aionda aims to turn fast community signals into evidence-based, practical AI writing. This page explains how we publish and maintain posts.'}
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
              {isKo ? '우리가 다루는 것' : 'What We Cover'}
            </h2>
            <ul className="space-y-2 text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>
                {isKo
                  ? '실무 관점의 AI: 도구, 에러, 워크플로우, 운영(모니터링/비용/품질)'
                  : 'Practical AI: tooling, errors, workflows, and operations (monitoring/cost/quality)'}
              </li>
              <li>
                {isKo
                  ? '신뢰 출처 기반의 리서치(공식 문서, 논문, 표준, 회사 릴리즈 노트)'
                  : 'Research anchored in primary sources (docs, papers, standards, release notes)'}
              </li>
              <li>
                {isKo ? '검색 의도에 맞춘 에버그린 글(입문/FAQ/How‑to)' : 'Evergreen pieces for search intent (explainer/FAQ/how-to)'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">
              {isKo ? '출처와 검증' : 'Sourcing & Verification'}
            </h2>
            <ul className="space-y-2 text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>
                {isKo
                  ? '커뮤니티(2차) 신호는 출발점일 수 있지만, 글의 결론은 가능한 한 1차/신뢰 출처로 뒷받침합니다.'
                  : 'Community posts can be a starting signal, but conclusions are backed by trusted/primary sources where possible.'}
              </li>
              <li>
                {isKo
                  ? '수치/가격/정책 같은 정량·규정 정보는 출처에 동일한 근거가 있을 때만 사용합니다.'
                  : 'We only include numbers/pricing/policy claims when the same information exists in cited sources.'}
              </li>
              <li>
                {isKo
                  ? '출처 링크는 글 하단 “참고 자료(References)” 섹션에 모아 제공합니다.'
                  : 'We collect trusted links in the “References” section at the end of each post.'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">
              {isKo ? 'AI 활용' : 'AI Usage'}
            </h2>
            <ul className="space-y-2 text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>
                {isKo
                  ? '우리는 초안을 만들고, 검색 기반 검증을 돕기 위해 LLM을 사용합니다.'
                  : 'We use LLMs to draft content and assist search-based verification.'}
              </li>
              <li>
                {isKo
                  ? '단정적 표현/과장/출처 없는 주장을 최소화하고, 독자가 바로 실행할 수 있는 체크리스트를 우선합니다.'
                  : 'We minimize hype and unsupported claims, and prioritize actionable checklists.'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">
              {isKo ? '업데이트(최신성)' : 'Updates (Freshness)'}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {isKo
                ? '정책/가격/모델은 자주 바뀝니다. 에버그린 글은 “검토일(lastReviewedAt)”을 갱신해 최신성 신호를 관리합니다.'
                : 'Policies/pricing/models change frequently. For evergreen posts, we update the review date (lastReviewedAt) as we re-check content.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">
              {isKo ? '정정(오류 제보)' : 'Corrections'}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {isKo ? (
                <>
                  오류를 발견하셨다면{' '}
                  <Link href={`/${locale}/corrections`} className="text-primary hover:underline">
                    정정/오류 제보 페이지
                  </Link>
                  로 알려주세요.
                </>
              ) : (
                <>
                  If you find an error, please report it via the{' '}
                  <Link href={`/${locale}/corrections`} className="text-primary hover:underline">
                    corrections page
                  </Link>
                  .
                </>
              )}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

