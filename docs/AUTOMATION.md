# 자동 발행(Automation) 운영 메모

## 실행 주체

- GitHub Actions: `.github/workflows/auto-update.yml`의 `schedule`은 주석 처리되어 있으며, 현재는 `workflow_dispatch`(수동 실행)만 활성입니다.
- 로컬 cron: 매시간 `scripts/auto-publish.sh`가 실행됩니다.
  - 확인: `crontab -l` → `0 * * * * /home/kkaemo/projects/aionda/scripts/auto-publish.sh`

## 로그 위치

- `/home/kkaemo/projects/aionda/logs/auto-publish-YYYYMMDD.log`

## “파이프라인이 안 도는 것 같다” 체크리스트

1. **GitHub에서 자동 실행을 기대했다면**
   - 현재 GitHub Actions 스케줄이 꺼져 있어서 자동으로 안 돕니다(수동 실행만).
2. **cron이 실제로 안 도는 경우**
   - `systemctl is-active cron`이 `active`인지 확인.
3. **cron은 도는데 글이 안 생기는 경우**
   - `extract-topics`/`research-topic` 결과에서 `canPublish: false`면 글이 생성되지 않는 것이 정상입니다.
4. **게이트에서 막혀서 중단되는 경우**
   - `content:gate:publish`는 `content:lint -- --strict` + `content:verify`를 포함합니다.
   - 경고(예: hype 단어)도 strict에선 실패 원인이 될 수 있습니다.

## 안전장치(2026-01-23)

- `scripts/auto-publish.sh`는 **워크트리가 dirty(unstaged/staged/untracked)**이면, 개발 중 변경사항이 자동 발행에 섞이는 것을 막기 위해 해당 실행을 스킵합니다.
