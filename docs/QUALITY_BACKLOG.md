# Content Quality Backlog

## Summary
- 목적: 크롤링 → 검증 → 구조화 → 게시 파이프라인에서 품질 이슈를 기록하고 재발 방지.
- 범위: 원문 수집, 구조화 결과, 태그/카테고리 UX, 중복 게시물, 메타데이터 정확성.

## Current Issues
1. 원문 `contentText`가 줄바꿈 없이 수집되어 본문이 한 줄로 뭉개짐.
2. 태그 클릭 UX 부재로 필터가 동작하지 않는 것처럼 보임.
3. 동일 `sourceId` 기반의 중복 게시물 존재(예: `930830`, `929648`).
4. 번역본이 없는 글에 `alternateLocale`이 기록되어 hreflang이 잘못될 수 있음.
5. 린트 설정이 없어 `next lint` 실행 시 초기 설정 프롬프트 발생.

## Fixes Applied (this pass)
- 크롤러에서 HTML을 줄바꿈 보존 텍스트로 변환하도록 개선.
- 태그 배지를 링크로 전환하고, `/posts?tag=` 필터 지원 추가.
- 게시물 카드에서 중첩 링크 제거로 태그 클릭이 실제로 동작하도록 수정.
- `alternateLocale`는 실제 존재하는 번역 경로만 유지하도록 정규화.
- `sourceId` 중복 게시물 제거 (`930830`, `929648`).
- `generate-post`에서 동일 `sourceId` 중복 파일 자동 제거.
- 파이프라인 재실행(crawl → auto-select → verify → translate → generate-post)으로 신규 글 생성.
- `generate-post` 슬러그 품질 검증(숫자/짧은 슬러그 회피) 및 파일명-슬러그 불일치 중복 제거.
- 모델 태그에 한글 표기(예: 젬나이/제미나이) 매칭 추가.
- `getPostBySlug`를 단일 파일 읽기로 최적화하고 hreflang 경로 캐시 도입.
- 홈 사이드바 인기 글 계산을 `useMemo`로 고정해 리렌더 비용 절감.
- auto-select 품질 게이트 강화(길이/노이즈/외부 URL/키워드/참여도 기준).
- generate-post 품질 게이트 강화(검증 점수/문단 수/노이즈/의견 제한) 및 스킵 시 게시물 제거.
- 커버 이미지 파일이 없으면 자동으로 placeholder를 사용하도록 처리.
- ChatGPT/Gemini 표기 통일(제미나이/젬나이, 챗지피티 등 정규화) 및 태그 정규화.
- 커버 이미지는 `ENABLE_COVER_IMAGES=true`일 때만 활성화(기본 비활성).

## Action Items
### P0
- 크롤러 변경 적용 후 `crawl → verify → translate → generate-post` 재실행으로 기존 데이터 재생성.
- 중복 제거 이후 재생성 결과에서 본문 줄바꿈/헤딩 정상 여부 확인.

### P1
- `generate-post` 품질 게이트 추가:
  - 구조화 결과가 단일 문단/라인으로 뭉쳐 있을 때 자동 스킵.
  - 헤딩/문단 최소 수 기준 추가.
- 태그/카테고리 정책 통일:
  - 홈 카테고리(AGI/LLM/Hardware/News/Opinion/Robotics)와 생성 태그 매핑 정리.

### P2
- `next lint` 설정 파일 추가 및 기본 린트 실행 루틴 확정.
- 게시물 카드/상세에서 태그 다중 표시 기준 정리(현재 1개만 표시).

## Verification Checklist
- [ ] `data/raw`의 `contentText`가 줄바꿈을 포함하는지 확인
- [ ] `apps/web/content/posts` 재생성 후 태그 필터 정상 동작 확인
- [ ] 중복 `sourceId` 게시물 제거 확인
- [ ] hreflang에 유효 경로만 노출되는지 확인
