# 자동 발행(Automation) 운영 메모

이 문서는 “왜 글이 안 올라오지?” 같은 운영 이슈를 **빠르게 진단/복구**하기 위한 메모입니다.

## 실행 주체

- GitHub Actions: `.github/workflows/auto-update.yml`의 `schedule`은 주석 처리되어 있으며, 현재는 `workflow_dispatch`(수동 실행)만 활성입니다.
- 로컬 cron: 매시간 `scripts/auto-publish.sh`가 실행됩니다.
  - 확인: `crontab -l` → `0 * * * * /home/kkaemo/projects/aionda/scripts/auto-publish.sh`

## 로그 위치

- `/home/kkaemo/projects/aionda/logs/auto-publish-YYYYMMDD.log`

## 실행 상태 확인(로컬)

- 마지막 실행 시각: `/tmp/aionda-auto-publish-last-run.txt`
- 중복 실행 방지 락: `/tmp/aionda-auto-publish.lock`
- 상태: `/tmp/aionda-auto-publish-status.txt`
  - 예: `published: <slug>` / `completed` / `completed: no changes` / `skipped: dirty worktree` / `failed: exit=<code>`

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

## 안전장치(자동화가 멈추지 않게)

- `scripts/auto-publish.sh`는 **워크트리가 dirty(unstaged/staged/untracked)**이면, 개발 중 변경사항이 자동 발행에 섞이는 것을 막기 위해 해당 실행을 스킵합니다.
- 다만 “이전 실패 실행이 남긴 untracked 산출물(MDX/이미지)” 때문에 계속 스킵되는 문제가 있었고, 이제는 아래 후보 풀로 자동 이동시켜 cron이 계속 진행됩니다.

## 후보 풀(Candidate Pool)

“블로그에 못 올라간 쓰레기(B급)” 같은 표현 대신, 운영적으로는 **후보 풀**로 부릅니다.

### 1) verify 실패로 보류된 글(레포 내부)

- 위치: `.vc/candidate-pool/<timestamp>/`
- 동작: `content:verify`가 실패하면, 새로 생성된(untracked) ko/en 글을 이 폴더로 **이동**하고 `manifest.json`에 이유/리포트/지표를 남깁니다.
- 레포트 보기:
  - `pnpm -s tsx scripts/candidate-pool-report.ts`

### 2) 이전 실패 실행의 “잔여 산출물”(레포 외부)

이전 실행이 중간에 죽으면, 레포 안에 untracked 글/이미지가 남아 다음 cron이 “dirty worktree”로 계속 스킵될 수 있습니다.

- 기본 위치: `/home/kkaemo/aionda-candidate-pool/<timestamp>/`
- 레거시 호환: 기존 `/home/kkaemo/aionda-quarantine/`가 있으면 그쪽을 계속 사용할 수 있습니다.

## 운영용 커맨드 모음

```bash
# 지금 당장 한 번 돌려보기(빌드는 스킵 가능)
cd /home/kkaemo/projects/aionda
AUTO_PUBLISH_SKIP_BUILD=true bash scripts/auto-publish.sh

# 상태/마지막 실행
cat /tmp/aionda-auto-publish-status.txt
cat /tmp/aionda-auto-publish-last-run.txt

# 로그 확인
tail -200 logs/auto-publish-$(date +%Y%m%d).log

# 후보 풀 리포트
pnpm -s tsx scripts/candidate-pool-report.ts
```
