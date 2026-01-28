# Verification (SearchMode)

이 문서는 **프로덕션 발행 파이프라인에서 사용하는 사실 검증 게이트(Verification Gate)** 의 SSOT입니다.

## 프로덕션 엔트리 포인트

- `pnpm content:verify`
  - 변경/신규 포스트에서 **검증 가능한 주장(claim)** 을 추출하고 SearchMode로 검증합니다.
- `pnpm content:gate:publish`
  - `content:lint -- --strict` + `content:verify` + 제한적 self-heal + 후보 풀 격리까지 포함합니다.
- `scripts/auto-publish.sh` (cron)
  - 시간 단위 자동 발행에서 위 publish gate를 호출합니다.

## “Verified” 판정 규칙(요약)

- **90% 룰**: confidence < 0.9 → `verified: false`
- **출처 위조 금지**: URL은 실제여야 하며, 애매하면 `sources: []`
- **Tier 우선순위**: S(학술) > A(공식/주요매체) > B(SNS/커뮤니티) > C(일반)
- **정량 주장 규칙**: 숫자/퍼센트/가격/기간을 쓸 때는 sources.snippet에서 같은 숫자가 확인되어야 합니다. 없으면 숫자를 빼고 정성 표현으로 바꿉니다.

## 출력물(로컬)

- 리포트: `.vc/content-verify-*.json`
- verify 실패로 보류된 글: `.vc/candidate-pool/<timestamp>/`

운영(troubleshooting, status 파일, candidate pool 리포트)은 `docs/AUTOMATION.md`를 참고하세요.

## 구현 위치

- 검증 실행: `scripts/content-verify.ts`, `scripts/content-gate.ts`, `scripts/content-repair.ts`
- SearchMode 클라이언트: `scripts/lib/gemini.ts`, `scripts/lib/search-mode.ts`
- 글쓰기 규칙(정량 주장 포함): `scripts/prompts/topics.ts`

