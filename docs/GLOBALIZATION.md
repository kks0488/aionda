# Globalization (i18n) — 운영 설계

목표는 “언어를 많이 늘리는 것”이 아니라, **검색/광고/브랜딩에 도움이 되는 방식으로** 안전하게 글로벌 페이지를 확장하는 것이다.

## 원칙

1) **전세계 언어 일괄 번역 금지**  
대량 기계 번역은 얇은 페이지/중복 페이지로 보일 확률이 높고, 운영 리스크(품질/검증/비용)가 급격히 커진다.

2) **언어는 단계적으로**  
기본은 `ko/en` 유지 + 추가는 ROI 높은 언어부터(현재는 `ko/en`만 활성화, `ja/es`는 보류).

3) **번역은 “선별 + 로컬라이징”**  
단순 번역이 아니라 제목/설명/키워드가 현지 검색어 관점에서 읽히도록 재작성(특히 Evergreen/가이드 글).

4) **hreflang는 “존재하는 언어만” 노출**  
없는 번역을 sitemap/hreflang에 넣지 않도록, 실제 파일 존재 기반으로 구성.

---

## 현재 구현 상태(요약)

### 1) 지원 Locale
- `apps/web/i18n.ts`에서 현재 `en/ko`만 활성화한다.
- UI 메시지는 `apps/web/messages/<locale>.json`에서 로드된다.

### 2) hreflang / canonical 전략
- 게시글 페이지(`apps/web/app/[locale]/posts/[slug]/page.tsx`)는 **같은 slug의 파일이 존재하는 locale만** `alternates.languages`에 넣는다.
- 요청 locale에 글이 없으면:
  - `robots: noindex`로 “브릿지 페이지”를 검색 결과에서 제외하고,
  - 존재하는 버전 중 1개를 canonical로 지정한다(기본: `defaultLocale` 우선).

### 3) 일일 “자료 모음(링크 라운드업)”
- `scripts/generate-roundup.ts`는 크롤링된 `data/official`, `data/news`를 기반으로
  - `ko/en` 2개 언어로 **링크 아카이브 포스트**를 생성한다.
  - (요약 기사 X, 원문으로 빠르게 들어가는 인덱스 O)
- `scripts/auto-publish.sh`의 `roundup` 모드에서 자동 발행된다.

---

## 운영 추천(다음 단계)

### A) 번역 대상 우선순위
1) 매일 라운드업(링크 아카이브) → **저비용/저위험으로 글로벌 페이지 수 확보**
2) Evergreen(가이드/비교/체크리스트) 상위 글만 → **검색 트래픽 장기 확보**
3) 트렌드성/속보성 글은 EN만(또는 번역은 지연) → **품질/중복 리스크 감소**

### B) 품질 게이트(권장)
- 번역 확장 시에도 `content:gate:publish` 기준을 통과해야 하며,
  - 출처 없는 단정(특히 모델 버전/출시/수치)을 금지한다.
- “옛날 모델” 키워드가 제목/요약에 무의미하게 박히면 최신성 체감이 떨어지므로, 레거시 앵커링을 계속 방지한다.

### C) 언어 추가 시 체크리스트
- `apps/web/i18n.ts`에 locale 추가
- `apps/web/messages/<locale>.json` 추가(최소 키라도 존재해야 함)
- `apps/web/app/layout.tsx` alternates 업데이트
- `apps/web/app/robots.ts` admin disallow 업데이트
- (선택) `apps/web/components/HomeContent.tsx` 카테고리 라벨 추가
