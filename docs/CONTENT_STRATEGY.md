# Aionda Content Strategy (Ops Notes)

목표: **Aionda를 “대한민국 대표 AI 블로그”로 성장**시키기 위해, “최신성(신호)”과 “신뢰(근거)”와 “검색 유입(에버그린)”을 동시에 운영한다.

---

## 1) 3-Lane 발행 전략

`scripts/auto-publish.sh`는 슬롯(slot) 기반으로 발행 모드를 선택한다.

1. `trend` (커뮤니티 신호)
   - DCInside 등 커뮤니티에서 “지금 뜨는 이슈”를 빠르게 포착
2. `standard` (신뢰/최신)
   - RSS 기반 **공식/신뢰 소스(official/news)**에서 최신 이슈를 우선 발행
3. `evergreen` (검색형)
   - 조용한 시간에도 콘텐츠가 멈추지 않도록, “검색 의도 기반” 큐에서 Pillar/Explainer를 생산

---

## 2) 운영자가 조절할 핵심 환경변수

권장 목표(기본): **trusted(공식/신뢰) 비중을 올리고**, 커뮤니티는 `trend`로 “신호”만 뽑는다.

- `AUTO_PUBLISH_TREND_EVERY` (기본: `5`)
  - 커뮤니티/트렌드 포스트의 빈도
- `AUTO_PUBLISH_STANDARD_SINCE` (기본: `48h`)
  - standard 모드에서 최신성 기준(짧게 유지할수록 “구닥다리” 느낌이 줄어듦)
- `AUTO_PUBLISH_STANDARD_SOURCES` (기본: `official,news`)
  - standard 모드의 소스 우선순위(기본은 community를 넣지 않음)
- `AUTO_PUBLISH_EVERGREEN_EVERY` (기본: `3`)
  - evergreen 포스트의 빈도(검색 유입을 올리고 싶으면 낮추고, “최신 피드” 중심이면 높인다)
- `AUTO_PUBLISH_DAILY_MAX` (기본: `12`)
  - 하루 최대 발행 수
- `AUTO_PUBLISH_MIN_INTERVAL_MINUTES` (기본: `30`)
  - 연속 발행 최소 간격(너무 짧게 하면 품질/운영 안정성이 흔들릴 수 있음)

---

## 3) 태그/SEO 위생 (구닥다리 느낌 제거에 직결)

문제: 자동 생성 태그가 무제한으로 늘어나면,
- 탐색(메뉴/태그)이 난잡해지고
- SEO가 “롱테일 태그 페이지”로 분산되며
- 구형 모델명/버전 태그가 남아 “고정된 느낌”을 줄 수 있다.

해결:
- 글 작성 단계에서 태그를 **허용 리스트 기반으로 정규화/축약**한다.
  - 설정: `scripts/lib/tags.ts`
- 웹에서 읽어올 때도 모델 버전 태그를 “패밀리 태그”로 축약한다.
  - 설정: `apps/web/lib/posts.ts`
- 태그 페이지는 “의미 있는 태그(최소 3개 글)” 중심으로 sitemap에 노출한다.
  - 설정: `apps/web/app/sitemap.ts`

---

## 4) “예전 모델” 고정 느낌 방지

원칙: 출처에 없는 모델/버전 언급은 줄이고, 필요하면 “계열(패밀리)”로 일반화한다.

- 글 작성 단계에서 **출처 스니펫/원문 발췌에 없는 모델-버전 멘션을 자동 완화**한다.
  - 구현: `scripts/write-article.ts`
- 발행 전 게이트에서 “최근 글이 구형 모델만 캐주얼하게 언급”하면 실패 처리한다.
  - 구현: `scripts/content-gate.ts`

---

## 5) 국내 기업 소스 강화

RSS 소스에 국내 테크 블로그를 추가해 “국내 운영/제품” 관점을 보강한다.
- 설정: `scripts/crawl-rss.ts`
- 신뢰 티어(A) 분류: `scripts/lib/search-mode.ts`

---

## 6) 현재 상태를 숫자로 확인(중요)

발행 방향이 맞는지 “감”으로 보지 않고, 숫자로 확인한다.

- 최근 콘텐츠 믹스(소스/시리즈/태그):
  - `pnpm -s content:mix --days=7`
- 발행 throughput + 게이트 성공 여부(로그 기반):
  - `pnpm -s tsx scripts/publish-metrics.ts --days=7`

---

## 7) 자주 보는 운영 파일

- Cron 로그: `logs/auto-publish-YYYYMMDD.log`
- 상태 파일(크론 동작 확인):
  - `/tmp/aionda-auto-publish-last-run.txt`
  - `/tmp/aionda-auto-publish-status.txt`

