# Coolify 배포 가이드

AI온다 블로그를 Coolify에 배포하는 가이드입니다.

---

## 사전 요구사항

- Coolify 서버 (최소 8GB RAM 권장 - Next.js 빌드 시 메모리 사용량 높음)
- GitHub 저장소 연결 또는 Git 접근 설정
- 도메인 (선택사항: aionda.blog)

---

## 1단계: Coolify 프로젝트 생성

### 1.1 새 프로젝트 생성

1. Coolify 대시보드 접속
2. **Projects** → **New Project** 클릭
3. 프로젝트 이름: `aionda` 입력
4. **Create** 클릭

### 1.2 리소스 추가

1. 생성된 프로젝트 클릭
2. **Add Resource** → **Application** 선택
3. **Source**: GitHub (또는 직접 Git URL)
4. 저장소 선택 또는 URL 입력

---

## 2단계: 빌드 설정

### 2.1 Build Pack 설정

| 설정 | 값 |
|------|-----|
| Build Pack | **Dockerfile** |
| Dockerfile Location | `Dockerfile` (루트) |
| Docker Build Context | `.` |

### 2.2 포트 설정

| 설정 | 값 |
|------|-----|
| Ports Exposes | `3000` |
| Port Mapping | `3000:3000` |

### 2.3 Health Check (선택사항)

| 설정 | 값 |
|------|-----|
| Health Check Path | `/ko` |
| Health Check Interval | `30s` |

---

## 3단계: 환경변수 설정

### 필수 환경변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NODE_ENV` | 환경 설정 | `production` |
| `PORT` | 포트 | `3000` |

### 선택 환경변수 (Analytics/Ads)

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NEXT_PUBLIC_GA_ID` | Google Analytics ID | `G-XXXXXXXXXX` |
| `NEXT_PUBLIC_ADSENSE_ID` | Google AdSense ID | `ca-pub-XXXXXXXX` |
| `NEXT_PUBLIC_SITE_URL` | 사이트 URL | `https://aionda.blog` |

### Admin 기능 (선택)

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `ADMIN_API_KEY` | Admin API 키 | `your-secret-key` |
| `ADMIN_LOCAL_ONLY` | 로컬 전용 여부 | `true` |

---

## 4단계: 도메인 설정

### 4.1 Coolify에서 도메인 추가

1. Application 설정 → **Domains** 섹션
2. `aionda.blog` 입력
3. SSL/TLS: **Let's Encrypt** 자동 활성화

### 4.2 DNS 설정 (도메인 등록업체)

```
Type: A
Name: @
Value: [Coolify 서버 IP]

Type: CNAME
Name: www
Value: aionda.blog
```

---

## 5단계: 배포

### 자동 배포 (권장)

1. **Webhooks** 활성화 → GitHub Push 시 자동 배포
2. 또는 **Deploy** 버튼 클릭으로 수동 배포

### 배포 확인

```bash
# 로그 확인
docker logs aionda-web

# 상태 확인
curl -I https://aionda.blog/ko
```

---

## 빌드 최적화 팁

### 메모리 문제 해결

Next.js 14 빌드는 메모리를 많이 사용합니다. 빌드 실패 시:

1. Coolify 서버 RAM 증가 (최소 8GB 권장)
2. 또는 Swap 메모리 추가:
   ```bash
   # 서버에서 실행
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

### 빌드 캐시 활용

Coolify는 Docker 레이어 캐시를 자동으로 활용합니다.
`pnpm-lock.yaml`이 변경되지 않으면 의존성 설치 단계가 캐시됩니다.

---

## 문제 해결

### 빌드 실패

```bash
# 1. 로컬에서 먼저 테스트
docker build -t aionda .
docker run -p 3000:3000 aionda

# 2. 빌드 로그 확인
# Coolify 대시보드 → Deployments → View Logs
```

### 포트 연결 안됨

1. Ports Exposes가 `3000`인지 확인
2. 방화벽 설정 확인:
   ```bash
   sudo ufw allow 3000
   ```

### SSL 인증서 오류

1. 도메인 DNS 전파 확인 (최대 48시간)
2. Coolify에서 SSL 재발급:
   - Application → SSL → Renew Certificate

---

## 로컬 테스트

배포 전 로컬에서 Docker 빌드 테스트:

```bash
cd /home/kkaemo/projects/aionda

# 빌드
docker build -t aionda .

# 실행
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
  aionda

# 접속 확인
curl http://localhost:3000/ko
```

---

## 파일 구조

```
aionda/
├── Dockerfile              # Docker 빌드 설정
├── docker-compose.yml      # 로컬 개발용
├── .dockerignore           # Docker 빌드 제외 파일
├── apps/web/               # Next.js 웹앱
│   ├── next.config.mjs     # standalone output 설정됨
│   └── ...
└── COOLIFY_DEPLOY.md       # 이 문서
```

---

## 추가 리소스

- [Coolify 공식 문서](https://coolify.io/docs)
- [Next.js Docker 배포](https://nextjs.org/docs/app/building-your-application/deploying#docker-image)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Vercel 배포 가이드
