# AI온다 (aionda.blog) 배포 가이드

## 준비 완료 상태

- [x] 도메인: aionda.blog
- [x] SEO: sitemap.xml, robots.txt, JSON-LD 구조화 데이터, RSS 피드
- [x] 법적 페이지: 개인정보처리방침, 이용약관, 소개
- [x] Analytics: Google Analytics 컴포넌트
- [x] Ads: Google AdSense 컴포넌트
- [x] 빌드: 49개 페이지 정상 생성

---

## 1단계: Vercel 배포

### 방법 A: GitHub 연동 (권장)

```bash
# 1. Git 초기화 및 커밋
cd /home/kkaemo/projects/singularity-blog
git init
git add .
git commit -m "Initial commit: AI온다 blog ready for production"

# 2. GitHub 저장소 생성 후 push
git remote add origin https://github.com/YOUR_USERNAME/aionda-blog.git
git push -u origin main
```

3. [Vercel](https://vercel.com)에 로그인
4. "Import Project" → GitHub 저장소 선택
5. Framework: Next.js 자동 감지
6. Root Directory: `apps/web`
7. Deploy 클릭

### 방법 B: Vercel CLI

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
cd /home/kkaemo/projects/singularity-blog
vercel

# 프로덕션 배포
vercel --prod
```

---

## 2단계: 도메인 연결 (aionda.blog)

### Vercel 대시보드에서:
1. Project Settings → Domains
2. "aionda.blog" 입력
3. Vercel이 제공하는 DNS 설정을 도메인 등록업체에서 설정:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

---

## 3단계: 환경변수 설정

Vercel 대시보드 → Project Settings → Environment Variables:

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `NEXT_PUBLIC_GA_ID` | G-XXXXXXXXXX | Google Analytics 측정 ID |
| `NEXT_PUBLIC_ADSENSE_ID` | ca-pub-XXXXXXXX | AdSense 게시자 ID |

---

## 4단계: Google Search Console 등록

### 4.1 사이트 소유권 확인

1. [Google Search Console](https://search.google.com/search-console) 접속
2. "속성 추가" → "URL 접두어" → `https://aionda.blog` 입력
3. 소유권 확인 방법 선택:

**방법 A: DNS 레코드 (권장)**
```
Type: TXT
Name: @
Value: google-site-verification=XXXXXXXXXXXXXXXX
```

**방법 B: HTML 태그**
`apps/web/app/layout.tsx`의 metadata에 추가:
```typescript
verification: {
  google: 'XXXXXXXXXXXXXXXX',
},
```

### 4.2 Sitemap 제출

1. Search Console → Sitemaps
2. URL 입력: `https://aionda.blog/sitemap.xml`
3. 제출

---

## 5단계: Google Analytics 설정

1. [Google Analytics](https://analytics.google.com) 접속
2. 관리 → 속성 만들기
3. 웹사이트 URL: `https://aionda.blog`
4. 측정 ID (G-XXXXXXXXXX) 복사
5. Vercel 환경변수에 `NEXT_PUBLIC_GA_ID` 추가

---

## 6단계: Google AdSense 신청

### 신청 요건
- [x] 고유 콘텐츠 15개 이상 (현재: 16개 × 2언어 = 32개)
- [x] 개인정보처리방침 페이지
- [x] 이용약관 페이지
- [x] 연락처/소개 페이지
- [ ] 도메인 등록 후 최소 2-3개월 권장

### 신청 절차

1. [Google AdSense](https://www.google.com/adsense) 접속
2. 사이트 URL: `https://aionda.blog` 입력
3. 계정 생성 및 약관 동의
4. 게시자 ID (ca-pub-XXXXXXXX) 복사
5. Vercel 환경변수에 `NEXT_PUBLIC_ADSENSE_ID` 추가
6. 재배포: `vercel --prod`
7. AdSense에서 사이트 검토 요청

### 승인 팁
- 주 2-3회 새 콘텐츠 발행
- 방문자 유입 (SNS 공유 등)
- 모바일 친화적 디자인 (이미 적용됨)
- 페이지 로드 속도 (Next.js SSG로 최적화됨)

---

## 주요 URL

| URL | 용도 |
|-----|------|
| https://aionda.blog | 메인 (한국어) |
| https://aionda.blog/en | 영어 버전 |
| https://aionda.blog/sitemap.xml | 사이트맵 |
| https://aionda.blog/feed.xml | RSS 피드 |
| https://aionda.blog/ko/privacy | 개인정보처리방침 |
| https://aionda.blog/ko/terms | 이용약관 |
| https://aionda.blog/ko/about | 소개 |

---

## 문제 해결

### 빌드 실패
```bash
cd /home/kkaemo/projects/singularity-blog/apps/web
npm run build
```

### 환경변수 미적용
- Vercel 재배포 필요
- 환경변수 변경 후 "Redeploy" 클릭

### 도메인 연결 안됨
- DNS 전파에 최대 48시간 소요
- `dig aionda.blog` 명령으로 확인

---

## 다음 단계 (선택)

1. **콘텐츠 증가**: 매주 새 글 발행
2. **소셜 미디어**: Twitter/X, LinkedIn 연동
3. **뉴스레터**: Buttondown, Substack 연동
4. **댓글 시스템**: Giscus (GitHub 기반) 추가
5. **검색 기능**: Algolia 또는 자체 검색 구현
