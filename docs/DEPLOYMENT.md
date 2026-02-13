# Deployment (aionda.blog)

이 문서는 aionda를 프로덕션에 배포하는 방법을 정리합니다. 배포 관련 문서의 SSOT는 이 파일입니다.

## 배포 방식

- **Vercel (권장)**: `main` 브랜치 push → 자동 배포
- **Coolify (Dockerfile)**: Docker 빌드/배포 기반 운영

> 자동 글 발행/운영(크론, 상태 파일, 후보 풀)은 `docs/AUTOMATION.md`를 참고하세요.

## 사전 준비

- Node.js **20+** (Vercel/도커 기준)
- pnpm (repo는 `package.json`의 `packageManager`를 따름)
- GitHub 저장소

## Vercel 배포

### 1) 프로젝트 Import

1. Vercel → **Add New Project** → GitHub 저장소 선택
2. **Root Directory**: repo root (모노레포)
3. Build/Install:
   - Install Command: `pnpm install --frozen-lockfile`
   - Build Command: `pnpm build` (root의 `pnpm --filter web build`를 사용)

### GitHub 저장소 Private 전환 (운영 영향)

결론: **Vercel은 GitHub Private repo에서도 정상 배포가 가능**합니다. 다만 전제 조건이 있습니다.

- **필수 전제**: Vercel의 GitHub Integration(“Vercel” GitHub App)이 해당 repo에 접근 권한을 유지해야 합니다.
- **전환 후 체크**: Private로 전환한 뒤 `main`에 커밋을 1개 푸시해서 자동 배포가 트리거되는지 확인하세요.
- **실패 시 대응**: Vercel Dashboard → Project → Settings → Git에서 연결 상태를 확인하고, GitHub App 권한(Selected repositories/All) 범위를 재승인합니다.

주의:
- GitHub Organization 소유의 private repo를 Vercel에서 운영할 때는 **플랜/권한/커밋 작성자 권한** 조합에 따라 제약이 생길 수 있습니다. (개인 계정 소유 repo는 영향이 상대적으로 적습니다.)

### 2) 환경변수

Vercel Dashboard → Project → Settings → Environment Variables

| 변수 | 설명 | 필수 |
|------|------|------|
| `NEXT_PUBLIC_SITE_URL` | 사이트 URL (예: `https://aionda.blog`) | 권장 |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 측정 ID | 선택 |
| `NEXT_PUBLIC_ADSENSE_ID` | AdSense 게시자 ID | 선택 |

### 3) 도메인 연결(선택)

Vercel Dashboard → Project → Settings → Domains에서 도메인을 추가한 뒤,
도메인 등록업체(DNS)에 아래처럼 설정합니다.

```text
# Apex 도메인
A     @    76.76.21.21

# www 서브도메인
CNAME www  cname.vercel-dns.com
```

### 4) Search Console (권장)

- 속성 추가 후 사이트맵 제출: `https://aionda.blog/sitemap.xml`
- 필요하면 `NEXT_PUBLIC_GOOGLE_VERIFICATION` 환경변수를 추가합니다. (없으면 verification 메타 태그는 생성되지 않음)

#### Admin API (선택)

Admin 기능을 쓰는 경우에만 설정하세요.

| 변수 | 설명 |
|------|------|
| `ADMIN_API_KEY` | Admin API 인증 키 (요청 헤더 `x-api-key`) |
| `ADMIN_LOCAL_ONLY` | 기본 `true`(로컬/사설망만). 외부에서 쓰려면 `false` + 보안 강화 필요 |
| `ADMIN_PUBLISH_ENABLED` | `true`일 때만 publish 엔드포인트 활성 |
| `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_TOKEN` | GitHub 콘텐츠 수정/PR/머지 자동화용 |
| `GITHUB_AUTO_MERGE` | `false`면 자동 머지 비활성 |
| `GITHUB_MERGE_METHOD` | `SQUASH`(기본) / `MERGE` / `REBASE` |

## Coolify 배포 (Dockerfile)

### 1) 애플리케이션 생성

- Build Pack: **Dockerfile**
- Dockerfile Location: `Dockerfile`
- Build Context: `.`
- Exposed Port: `3000`
- Health Check Path(선택): `/ko`

> Next.js 빌드는 메모리를 많이 사용합니다. 서버 RAM이 부족하면 Swap을 추가하거나(예: 4GB) 빌드 리소스를 늘리세요.

### 2) 환경변수

`docker-compose.yml`의 `web.environment`와 동일한 값을 Coolify에서 설정하세요.

## 도메인 / SEO

- 사이트맵: `/sitemap.xml`
- robots.txt: `/robots.txt`
- RSS: `/feed.xml`

Vercel/Coolify 모두 도메인 연결 후 Google Search Console에 사이트맵을 제출하면 됩니다.

## Production 체크리스트 (권장)

- `main` push → Vercel 자동 배포가 트리거되는지 확인
- 캐시 헤더 확인: `/feed.xml`, `/sitemap.xml`, `/robots.txt` (SWR 설정 포함)
- Admin API 보호 확인: `/api/admin/*`는 `no-store` + `noindex` (robots disallow 포함)
- 버전 엔드포인트 확인: `/api/version`은 항상 `no-store`
- CI 확인: `CI` 워크플로우가 `build/lint`와 `vercel.json` parity를 통과

## 배포 전 로컬 체크(권장)

```bash
# Root tsconfig checks only scripts/packages (apps are excluded).
pnpm -s tsc --noEmit

# Web(apps) type checks run during Next.js build.
pnpm -s build
```

Docker 배포라면:

```bash
docker build -t aionda .
docker run -p 3000:3000 -e NEXT_PUBLIC_SITE_URL=http://localhost:3000 aionda
curl -I http://localhost:3000/ko
```
