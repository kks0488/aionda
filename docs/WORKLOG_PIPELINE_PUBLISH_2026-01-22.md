# 파이프라인 재실행/발행 작업 로그 (2026-01-22)

이 문서는 `pnpm pipeline:publish`를 다시 돌리면서 발생한 실패 원인(콘텐츠 게이트/검증/이미지)을 해결하고, 새 글 발행까지 완료한 과정을 정리합니다.

## 목표

- `pnpm pipeline:publish`를 끝까지 통과시켜 **새 글(ko/en) + 커버 이미지**를 생성/발행 가능한 상태로 만든다.
- 재발 가능성이 있는 문제(프론트매터 YAML, 검증 불가 클레임, 외부 검증 타임아웃)를 줄인다.

## 실행 커맨드

- 전체 발행 파이프라인: `pnpm pipeline:publish`
- 콘텐츠 게이트(검증 포함): `pnpm content:gate:publish`
- 커버 이미지 생성: `pnpm generate-image -- --limit=1` 또는 `pnpm generate-image -- --slug=<slug> --limit=1`

## 주요 이슈와 조치

### 1) 프론트매터 YAML 파싱 실패 (duplicated mapping key)

**증상**

- `pnpm pipeline:publish` 실행 중 `gray-matter/js-yaml`에서 `YAMLException: duplicated mapping key`로 중단.
- 원인 파일: `apps/web/content/posts/ko/chitchats-multimodal-gpt-5-2-codex-streaming.mdx`
- 프론트매터에 `description:` 라인이 2개 존재.

**조치**

- 중복 `description` 키를 제거하여 YAML 파싱 가능 상태로 복구.

---

### 2) 콘텐츠 검증(content:verify) 실패: “고우선(high)” 클레임이 검증 불가

**증상**

- `pnpm content:gate:publish` 단계에서 `pnpm content:verify`가 `failedHigh > 0`로 실패하여 파이프라인 중단.
- 실패 리포트는 `.vc/content-verify-*.json`으로 기록됨.
- 대표 케이스:
  - 벤치마크/성능 수치(예: AIME/GPQA/SWE-bench 등) 또는 내부 성과 수치(예: “학습 유지력 25%”)가 근거 없이 포함됨
  - “고소득 일자리(high-income jobs)”처럼 원문 의미와 어긋나는 표현

**조치**

- 숫자/모델 스펙/내부 지표처럼 **검증이 어려운 문장**을 보수적으로 재작성:
  - 근거가 명확한 1차 출처(예: 공식 블로그/문서) 중심으로만 서술
  - 불명확한 수치/날짜/고유명(사례명 등)은 제거하거나 “워크로드/구현에 따라 다름”으로 완화
- Praktika 관련 글은 OpenAI 사례 연구(`https://openai.com/index/praktika`) 내용에 맞춰 구조/문장을 정리.
- 노동시장 글(EN)은 `high-income jobs` → `jobs in high-income countries`로 의미를 바로잡음.

---

### 3) YAML 파싱 실패 (incomplete explicit mapping pair)

**증상**

- `pnpm content:style-fix`에서 `title: Praktika: ...`처럼 콜론(`:`) 포함 문자열이 따옴표 없이 쓰여 YAML 파싱 실패.

**조치**

- 해당 `title` 값을 따옴표로 감싸 YAML 안전하게 처리.

---

### 4) 외부 검증 타임아웃(AbortError)로 인한 불안정

**증상**

- `content:verify` 수행 중 Gemini 호출이 `AbortError`로 간헐 실패하여 검증 결과가 흔들림.

**조치**

- `scripts/lib/gemini.ts`에서 SearchMode 요청(verify/search)의 타임아웃/재시도/백오프를 강화:
  - `GEMINI_SEARCH_TIMEOUT_MS` 기본값 상향
  - AbortError 발생 시 backoff + jitter 적용 후 재시도 횟수 증가

> 참고: 검증은 외부 요인(검색/네트워크/모델 응답)에 영향을 받으므로, 가능하면 “검증 가능한 문장만 남기는 방향”이 가장 안정적입니다.

---

### 5) 커버 이미지 누락/불일치

**증상**

- 새 글 생성 후 `coverImage`는 존재하지만 실제 파일이 없거나, `generate-image`가 “다 있음”으로 스킵해버리는 케이스가 발생.

**조치**

- 슬러그를 명시해 강제로 이미지 생성:
  - 예: `pnpm generate-image -- --slug=high-performance-gpu-4k-ai-animation --limit=1`
- 생성 결과 확인:
  - `apps/web/public/images/posts/<slug>.png` 파일 존재 여부
  - 각 로케일 포스트의 `coverImage`가 동일 경로를 가리키는지 확인

## 결과(산출물)

### 파이프라인 통과

- `pnpm pipeline:publish` 최종 `exit=0`로 완료.
- 검증 리포트는 `.vc/content-verify-*.json`에 저장됨.

### 생성/갱신된 글(예시)

이번 작업 흐름에서 생성/갱신된 대표 슬러그:

- `financial-ai-on-premise-gpu-acceleration`
- `high-performance-gpu-4k-ai-animation`
- `google-deepmind-d4rt-4d-reconstruction`
- (갱신) `praktika-gpt-5-2-ai-education-agent`

### 커버 이미지

- `apps/web/public/images/posts/financial-ai-on-premise-gpu-acceleration.png`
- `apps/web/public/images/posts/high-performance-gpu-4k-ai-animation.png`
- `apps/web/public/images/posts/google-deepmind-d4rt-4d-reconstruction.png`

## Git 기록

- 수동 작업/수정 커밋: `7e43091` (`Publish pipeline: new posts + content gate fixes`)
- 자동 발행(오토 퍼블리셔) 커밋(추가 발생): `0ad8d95` (`auto: 새 글 발행 - neurophos-metamaterial-optical-ai-chip-investment`)

## 다음에 비슷한 문제가 나면(체크리스트)

1. 파이프라인 재실행: `pnpm pipeline:publish`
2. 실패가 YAML이면:
   - 프론트매터 중복 키/콜론 포함 문자열(`title`) 따옴표 여부 확인
3. 실패가 검증이면:
   - `.vc/content-verify-*.json`에서 `failedHighPriority`와 `correctedText`/`notes` 확인
   - 수치/날짜/벤치마크/사례명 등 검증 어려운 문장부터 제거/완화
4. 이미지면:
   - `pnpm generate-image -- --slug=<slug> --limit=1`
   - `apps/web/public/images/posts/<slug>.png` 존재 확인

---

## 2026-01-23 후속: “자동 발행이 안 도는 것 같다” 대응

- 원인 1) GitHub Actions 자동 스케줄은 꺼져 있음: `.github/workflows/auto-update.yml`의 schedule이 주석 처리되어 있고, 수동 실행(`workflow_dispatch`)만 활성.
- 원인 2) 로컬 cron은 도는데 게이트에서 실패:
  - strict lint 경고(예: hype 단어)가 exit=1로 이어져 `content:gate:publish`에서 중단될 수 있음.
- 개선:
  - `scripts/content-style-fix.ts`에서 hype 단어를 보수적으로 완화하는 규칙 추가(예: `unprecedented` 등).
  - `scripts/content-gate.ts`에서 strict 린트 실패 시 “마지막 생성 글”뿐 아니라 “변경된 글”까지 style-fix 대상으로 포함.
  - `scripts/auto-publish.sh`에서 워크트리가 dirty면 이번 실행을 스킵하여 개발 중 변경사항이 자동 발행에 섞이지 않도록 보호.
  - 검증 실패 시 ko/en 페어 일관성을 유지하도록 quarantine 로직 보강.
