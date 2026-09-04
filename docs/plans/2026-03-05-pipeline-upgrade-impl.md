# Pipeline Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** memU 전면 통합 + CLIProxyAPI 업그레이드 + 소스 확장 + 품질 강화로 aionda를 국내 최고 AI 블로그로 업그레이드

**Architecture:** CLIProxyAPI(8317)를 단일 AI 게이트웨이로, memU(8100)를 파이프라인 전 단계의 기억 시스템으로 통합. 로컬 fastembed(8201) 임베딩 유지. Phase 0-3 순차 적용.

**Tech Stack:** TypeScript (scripts), Go (CLIProxyAPI), Python (memU/fastembed), PostgreSQL+pgvector

**Design doc:** `docs/plans/2026-03-05-pipeline-upgrade-design.md`

---

## Task 1: CLIProxyAPI v6.8.40 업그레이드

**Files:**
- Modify: `/home/kkaemo/projects/CLIProxyAPI/` (git checkout + build)

**Step 1: config 백업**

```bash
cd /home/kkaemo/projects/CLIProxyAPI
cp config.yaml config.yaml.backup
```

**Step 2: 현재 실행 중인 프로세스 확인**

```bash
ps aux | grep -i cliproxy | grep -v grep
```
Expected: PID 확인 (현재 실행 중인 서버)

**Step 3: 최신 소스 가져오기**

```bash
cd /home/kkaemo/projects/CLIProxyAPI
git fetch origin --tags
git stash  # 로컬 변경 있으면 보존
git checkout v6.8.40
```
Expected: `HEAD is now at ... v6.8.40`

**Step 4: 빌드**

```bash
cd /home/kkaemo/projects/CLIProxyAPI
go build -o server ./cmd/server/
```
Expected: 에러 없이 `server` 바이너리 생성

**Step 5: config 호환성 확인**

```bash
cd /home/kkaemo/projects/CLIProxyAPI
diff config.yaml.backup config.example.yaml | head -50
```
Expected: breaking changes 없음 확인. 새 필드는 선택적.

**Step 6: 서버 재시작 및 검증**

```bash
# 기존 프로세스 종료
kill $(pgrep -f 'CLIProxyAPI.*server')
# 새 바이너리로 시작
cd /home/kkaemo/projects/CLIProxyAPI
nohup ./server > /tmp/cliproxy.log 2>&1 &
sleep 3
# 버전 확인 + LLM 호출 테스트
curl -s http://localhost:8317/v1/models | head -5
curl -s -X POST http://localhost:8317/v1/chat/completions \
  -H "Authorization: Bearer $(grep OPENAI_API_KEY /home/kkaemo/projects/aionda/.env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-5.2","messages":[{"role":"user","content":"say ok"}],"max_tokens":5}'
```
Expected: 모델 목록 반환 + `ok` 응답

**Step 7: memU 연동 확인**

```bash
curl -s http://localhost:8100/health
```
Expected: `{"status": "ok"}`

---

## Task 2: memU fail-close 강제 + 환경변수 정리

**Files:**
- Modify: `/home/kkaemo/projects/aionda/.env.local:끝부분`
- Modify: `/home/kkaemo/projects/aionda/.env.example:끝부분`

**Step 1: .env.local에 memU 변수 추가**

`.env.local` 끝에 추가:
```env
# memU (fail-close)
MEMU_API_URL=http://localhost:8100
REQUIRE_MEMU_FOR_PUBLISH=true
MEMU_TIMEOUT_MS=30000
```

**Step 2: .env.example에 memU 변수 문서화**

`.env.example` 끝에 추가:
```env
# === memU (중복 체크) ===
MEMU_API_URL=http://localhost:8100
REQUIRE_MEMU_FOR_PUBLISH=true    # true: memU 다운 시 발행 차단
MEMU_TIMEOUT_MS=30000
MEMU_FAIL_OPEN=false             # true: API 에러 시에도 발행 허용
```

**Step 3: memU 헬스 체크로 연동 확인**

```bash
curl -s http://localhost:8100/health && echo " OK"
curl -s -X POST http://localhost:8100/check-similar \
  -H "Content-Type: application/json" \
  -d '{"content":"test duplicate check","user_id":"aionda","threshold":0.85}' | head -3
```
Expected: health OK + check-similar 응답

**Step 4: 커밋**

```bash
cd /home/kkaemo/projects/aionda
git add .env.example
git commit -m "feat: memU fail-close 강제 + 환경변수 문서화"
```

---

## Task 3: Confidence calibration rubric

**Files:**
- Modify: `scripts/lib/gemini.ts:350-378` (searchAndVerify 프롬프트)
- Modify: `scripts/lib/gemini.ts:473-505` (verifyClaim 프롬프트)
- Modify: `scripts/lib/openai-search.ts:348-376` (searchAndVerify 프롬프트)
- Modify: `scripts/lib/openai-search.ts:479-514` (verifyClaim 프롬프트)

**Step 1: gemini.ts searchAndVerify 프롬프트에 rubric 추가**

`scripts/lib/gemini.ts:362` 근처의 `확신도 90% 미만이면 솔직하게 표시`를 다음으로 교체:

```
confidence는 아래 rubric에 따라 정확하게 매겨라:
- 0.95-1.0: 공식 문서에서 정확히 일치하는 문구를 찾음
- 0.85-0.94: 신뢰할 수 있는 출처(공식 블로그, 주요 언론)에서 핵심 사실 확인
- 0.70-0.84: 여러 출처에서 일관된 정보를 확인했으나 세부 불일치 존재
- 0.50-0.69: 관련 정보는 있으나 직접적 확인 불가
- 0.30-0.49: 약한 근거만 있거나 출처 신뢰도 낮음
- 0.30 미만: 확인 불가, 모순 정보, 또는 출처 없음
절대로 기본값으로 0.95를 사용하지 마라. 실제 근거 강도를 반영해라.
```

**Step 2: gemini.ts verifyClaim 프롬프트에 동일 rubric 적용**

`scripts/lib/gemini.ts:480` 근처의 `확신도 90% 미만이면 verified: false`를 같은 rubric으로 교체.

**Step 3: openai-search.ts에 동일 변경 적용**

`scripts/lib/openai-search.ts:360` (searchAndVerify)과 `:487` (verifyClaim)에 동일한 rubric 적용.

**Step 4: 검증 - 프롬프트 변경 확인**

```bash
cd /home/kkaemo/projects/aionda
grep -n "rubric" scripts/lib/gemini.ts scripts/lib/openai-search.ts
grep -n "0.95를 사용하지" scripts/lib/gemini.ts scripts/lib/openai-search.ts
```
Expected: 4곳에서 rubric 문자열 발견 (gemini 2곳 + openai-search 2곳)

**Step 5: 커밋**

```bash
git add scripts/lib/gemini.ts scripts/lib/openai-search.ts
git commit -m "feat: confidence calibration rubric 추가 (0.95 몰림 해소)"
```

---

## Task 4: RSS 소스 확장 (12개 추가)

**Files:**
- Modify: `scripts/crawl-rss.ts:55-90` (RSS_SOURCES 배열)

**Step 1: crawl-rss.ts 읽기**

현재 RSS_SOURCES 배열 전체를 확인하고 구조 파악.

**Step 2: AI 공식 블로그 누락분 추가 (Anthropic, Meta)**

`RSS_SOURCES` 배열의 Tier S Official 섹션 (line 59-64) 뒤에 추가:

```typescript
{ id: 'anthropic', name: 'Anthropic Blog', url: 'https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml', tier: 'S', type: 'official', enabled: true },
{ id: 'meta-ai', name: 'Meta AI Research', url: 'https://engineering.fb.com/category/ai-research/feed/', tier: 'S', type: 'official', enabled: true },
```

**Step 3: 한국 AI 전문 매체 추가**

```typescript
{ id: 'aitimes-kr', name: 'AI타임스', url: 'https://www.aitimes.com/rss/allArticle.xml', tier: 'A', type: 'news', enabled: true },
{ id: 'etnews-ai', name: '전자신문 AI', url: 'https://rss.etnews.com/Section901.xml', tier: 'A', type: 'news', enabled: true },
```

**Step 4: 뉴스 소스 보강 (The Verge AI)**

```typescript
{ id: 'theverge-ai', name: 'The Verge AI', url: 'https://www.theverge.com/ai/rss/index.xml', tier: 'A', type: 'news', enabled: true },
```

**Step 5: 독립 분석가/뉴스레터 추가**

```typescript
{ id: 'simon-willison', name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', tier: 'A', type: 'news', enabled: true },
{ id: 'interconnects', name: 'Interconnects', url: 'https://www.interconnects.ai/feed', tier: 'A', type: 'news', enabled: true },
{ id: 'ai-snake-oil', name: 'AI Snake Oil', url: 'https://www.aisnakeoil.com/feed', tier: 'B', type: 'news', enabled: true },
```

**Step 6: 리서치/논문 채널 추가**

```typescript
{ id: 'arxiv-cs-ai', name: 'arXiv CS.AI', url: 'https://rss.arxiv.org/rss/cs.AI', tier: 'S', type: 'official', enabled: true },
{ id: 'hf-papers', name: 'HuggingFace Papers', url: 'https://huggingface.co/papers/rss', tier: 'S', type: 'official', enabled: true },
```

**Step 7: 커뮤니티 채널 추가**

```typescript
{ id: 'hn-ai', name: 'Hacker News AI', url: 'https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT&points=50', tier: 'B', type: 'news', enabled: true },
{ id: 'reddit-ml', name: 'Reddit ML', url: 'https://www.reddit.com/r/MachineLearning/.rss', tier: 'B', type: 'news', enabled: true },
```

**Step 8: RSS 피드 접근성 테스트**

```bash
for url in \
  "https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml" \
  "https://engineering.fb.com/category/ai-research/feed/" \
  "https://www.aitimes.com/rss/allArticle.xml" \
  "https://www.theverge.com/ai/rss/index.xml" \
  "https://simonwillison.net/atom/everything/" \
  "https://rss.arxiv.org/rss/cs.AI" \
  "https://huggingface.co/papers/rss"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url")
  echo "$status $url"
done
```
Expected: 모든 URL에서 200 응답

**Step 9: 커밋**

```bash
git add scripts/crawl-rss.ts
git commit -m "feat: RSS 소스 12개 추가 (Anthropic, Meta, AI타임스, arXiv 등)"
```

---

## Task 5: 비효율 소스 정리

**Files:**
- Modify: `scripts/crawl-rss.ts:66-81` (클라우드/보안 + 한국 테크블로그 섹션)

**Step 1: 클라우드/보안 소스 비활성화**

`RSS_SOURCES` 배열에서 AI 비관련 클라우드/보안 소스의 `enabled: true`를 `enabled: false`로 변경:
- AWS Security Blog
- AWS Machine Learning (유지 - AI 관련)
- Cloudflare Blog
- Google Security Blog
- Mandiant Blog
- CrowdStrike Blog

AWS ML, Azure AI, HuggingFace는 AI 관련이므로 유지.

**Step 2: 한국 테크블로그 재평가**

AI 기여도가 극히 낮은 소스를 `enabled: false`로:
- GCCompany (12건 중 AI 관련 거의 없음)
- Coupang Engineering (0건)
- 우아한형제들 (2건)

Naver D2, Kakao, Toss는 간헐적으로 AI 글이 있으므로 유지.

**Step 3: 변경 소스 수 확인**

```bash
cd /home/kkaemo/projects/aionda
grep -c "enabled: true" scripts/crawl-rss.ts
grep -c "enabled: false" scripts/crawl-rss.ts
```
Expected: enabled: true 약 30개 (기존 26 - 비활성 6 + 신규 12), enabled: false 약 6개

**Step 4: 커밋**

```bash
git add scripts/crawl-rss.ts
git commit -m "chore: AI 비관련 RSS 소스 비활성화 (보안/클라우드/테크블로그)"
```

---

## Task 6: extract-topics에 memU 중복 체크 추가

**Files:**
- Modify: `scripts/extract-topics.ts:25-31` (import 추가)
- Modify: `scripts/extract-topics.ts:634-650` (토픽 추출 후 저장 전에 체크 삽입)

**Step 1: import 추가**

`scripts/extract-topics.ts` import 섹션에 추가:

```typescript
import { checkSimilar, checkMemuHealth } from './lib/memu-client';
```

**Step 2: 토픽 추출 후 memU 중복 체크 삽입**

`extractTopicFromPost()` 호출 후 (line 634), 토픽 저장 전 (line 636)에 삽입:

```typescript
// memU 중복 체크 (서버 가용 시에만)
const memuHealthy = await checkMemuHealth();
if (memuHealthy && topic) {
  const similar = await checkSimilar(
    topic.title + ' ' + (topic.description || ''),
    'aionda',
    0.80
  );
  if (similar && similar.is_similar) {
    console.log(`  [SKIP] memU 유사 토픽: "${similar.similar_items?.[0]?.summary?.slice(0, 60)}" (score: ${similar.similarity_score?.toFixed(2)})`);
    continue;
  }
}
```

**Step 3: 검증 - import 확인**

```bash
grep -n "memu-client" scripts/extract-topics.ts
grep -n "checkSimilar" scripts/extract-topics.ts
```
Expected: import 1줄 + 호출 1줄

**Step 4: dry-run 테스트**

```bash
cd /home/kkaemo/projects/aionda
pnpm extract-topics --dry-run 2>&1 | head -30
```
Expected: memU 체크 로그 확인 (또는 memU 다운 시 graceful skip)

**Step 5: 커밋**

```bash
git add scripts/extract-topics.ts
git commit -m "feat: extract-topics에 memU 중복 체크 추가 (threshold 0.80)"
```

---

## Task 7: research-topic에 memU retrieve 연동

**Files:**
- Modify: `scripts/research-topic.ts:18-24` (import 추가)
- Modify: `scripts/research-topic.ts:183-229` (researchQuestion 내부)
- Modify: `scripts/research-topic.ts:276-293` (결과 저장 후 memorize)

**Step 1: import 추가**

```typescript
import { retrieve, memorize, checkMemuHealth } from './lib/memu-client';
```

**Step 2: researchTopic 함수에 기존 리서치 참조 추가**

`researchTopic()` 함수 시작 부분 (findings 루프 전)에 추가:

```typescript
// memU에서 기존 관련 리서치 결과 참조
let existingContext = '';
const memuHealthy = await checkMemuHealth();
if (memuHealthy) {
  try {
    const existing = await retrieve(topic.title, 'aionda', 3);
    if (existing && existing.items && existing.items.length > 0) {
      existingContext = existing.items
        .map((item: any) => item.summary)
        .filter(Boolean)
        .join('\n');
      console.log(`  [memU] 기존 관련 리서치 ${existing.items.length}건 참조`);
    }
  } catch (e) {
    // memU 실패해도 리서치는 계속 진행
  }
}
```

**Step 3: 리서치 결과를 memU에 저장**

리서치 결과 JSON 파일 저장 직후 (line 293 근처)에 추가:

```typescript
// memU에 리서치 결과 저장 (best-effort)
if (memuHealthy) {
  try {
    const summaryForMemU = `[Research] ${topic.title}\n` +
      findings.map((f: any) => f.summary).filter(Boolean).join('\n');
    await memorize(summaryForMemU, 'aionda', {
      slug: topic.id,
      sourceType: topic.sourceType,
      confidence: overallConfidence,
    });
  } catch (e) {
    console.log(`  [memU] 저장 실패 (무시): ${(e as Error).message}`);
  }
}
```

**Step 4: 검증**

```bash
grep -n "memu-client" scripts/research-topic.ts
grep -n "retrieve\|memorize" scripts/research-topic.ts
```
Expected: import 1줄, retrieve 호출 1곳, memorize 호출 1곳

**Step 5: 커밋**

```bash
git add scripts/research-topic.ts
git commit -m "feat: research-topic에 memU retrieve/memorize 연동"
```

---

## Task 8: 도입부 패턴 다양화

**Files:**
- Modify: `scripts/prompts/topics.ts:164-167` (WRITE_ARTICLE_PROMPT 핵심 원칙 8)
- Modify: `scripts/prompts/topics.ts:188-191` (도입부 구조)
- Modify: `scripts/prompts/topics.ts:275-278` (WRITE_PROMPT_COMMON_RULES 핵심 원칙 8)
- Modify: `scripts/write-article.ts` (도입부 유형 인자 전달)

**Step 1: WRITE_ARTICLE_PROMPT 도입부 규칙 교체**

`scripts/prompts/topics.ts`에서 핵심 원칙 8 (line 164-167)의 장면 묘사 관련 내용을 다음으로 교체:

```typescript
8. 도입부는 아래 6가지 유형 중 지정된 유형을 사용한다. 지정이 없으면 A-E 중 하나를 선택한다:
   A. 데이터/수치: 핵심 숫자로 시작 ("3,200만 달러짜리 계약서 한 줄이...")
   B. 질문: 독자에게 직접 묻기 ("LLM이 표적 후보를 올리면, 그건 자율무기인가?")
   C. 인용: 핵심 인물의 말 인용 ("다리오 아모데이는 이것을 'straight up lies'라고 불렀다.")
   D. 반직관적 진술: 기대를 뒤집기 ("더 안전한 모델이 더 위험한 계약을 가져올 수 있다.")
   E. 맥락 대비: 과거와 현재 비교 ("2024년에는 윤리 선언이면 충분했다. 2026년에는 계약서가 더 세다.")
   F. 장면 묘사: 구체적 장면으로 시작 (배치당 최대 1편만 허용)
   주의: "장면은 이렇게 시작된다" 같은 메타 서술은 절대 금지.
```

**Step 2: WRITE_PROMPT_COMMON_RULES에도 동일 적용**

`scripts/prompts/topics.ts:275-278`의 동일한 핵심 원칙 8을 같은 내용으로 교체.

**Step 3: 도입부 구조 설명 업데이트**

`scripts/prompts/topics.ts:188-191` 도입부 구조를 다음으로 교체:

```typescript
1. 도입부 (2-3문장): 지정된 도입부 유형에 맞춰 작성. 첫 문장이 가장 중요하다. 핵심 인사이트 + 왜 중요한지.
```

**Step 4: write-article.ts에 도입부 유형 분배 로직 추가**

`scripts/write-article.ts`에서 글 작성 시 도입부 유형을 랜덤 분배하는 로직 추가. 프롬프트에 `도입부 유형: B (질문)` 형태로 인자 전달:

```typescript
const INTRO_TYPES = ['A', 'B', 'C', 'D', 'E'];
// F(장면묘사)는 배치에서 이미 사용되지 않았을 때만 추가
function getIntroType(batchIndex: number, batchSize: number): string {
  if (batchIndex === 0) return 'F'; // 첫 글만 장면 묘사 허용
  return INTRO_TYPES[batchIndex % INTRO_TYPES.length];
}
```

프롬프트에 삽입: `\n\n도입부 유형: ${introType} (위 6가지 중 해당 유형을 반드시 사용할 것)\n`

**Step 5: 검증**

```bash
grep -n "도입부.*유형" scripts/prompts/topics.ts
grep -n "INTRO_TYPES\|introType\|getIntroType" scripts/write-article.ts
```
Expected: prompts에 도입부 유형 규칙, write-article에 분배 로직

**Step 6: 커밋**

```bash
git add scripts/prompts/topics.ts scripts/write-article.ts
git commit -m "feat: 도입부 패턴 6유형 강제 분배 (장면묘사는 배치당 1편만)"
```

---

## Task 9: 주제 적합성 필터 강화

**Files:**
- Modify: `scripts/prompts/topics.ts:3-37` (EXTRACT_TOPIC_PROMPT)
- Modify: `scripts/prompts/topics.ts:39-83` (EXTRACT_TOPIC_FROM_NEWS_PROMPT)
- Modify: `scripts/extract-topics.ts:634` (후처리 검증)

**Step 1: 커뮤니티 프롬프트에 AI 관련도 점수 추가**

`scripts/prompts/topics.ts` EXTRACT_TOPIC_PROMPT (line 3-37)의 JSON 출력 스키마에 `aiRelevanceScore` 필드 추가:

```
"aiRelevanceScore": 0.0-1.0  // AI/ML/LLM과의 직접적 관련성 (0.5 미만이면 worthDiscussing을 false로)
```

worthDiscussing 판단 기준에 추가:
```
- AI/ML/LLM/데이터과학과 직접 관련이 없는 순수 역사/정치/문화 주제는 aiRelevanceScore 0.3 이하로 매기고 worthDiscussing: false
- 비유나 간접 언급만으로 AI 관련성을 주장하지 마라
```

**Step 2: 뉴스 프롬프트에도 동일 적용**

EXTRACT_TOPIC_FROM_NEWS_PROMPT (line 39-83)에도 같은 `aiRelevanceScore` 필드와 기준 추가.

**Step 3: extract-topics.ts에 aiRelevanceScore 후처리**

토픽 추출 결과를 받은 후 (line 634 근처), 저장 전에 체크:

```typescript
if (topic && topic.aiRelevanceScore !== undefined && topic.aiRelevanceScore < 0.5) {
  console.log(`  [SKIP] AI 관련도 낮음: ${topic.title} (score: ${topic.aiRelevanceScore})`);
  continue;
}
```

**Step 4: 동일 이벤트 제한 (같은 배치에서 유사 토픽 2편 이상 방지)**

토픽 배열 저장 후, 최종 출력 전에 dedup:

```typescript
// 배치 내 유사 토픽 제거: 같은 키워드 세트를 공유하는 토픽은 1편만
const seen = new Map<string, typeof extractedTopics[0]>();
for (const t of extractedTopics) {
  const key = (t.tags || []).sort().join(',');
  if (!seen.has(key) || (t.score || 0) > (seen.get(key)!.score || 0)) {
    seen.set(key, t);
  }
}
```

**Step 5: 검증**

```bash
grep -n "aiRelevanceScore" scripts/prompts/topics.ts scripts/extract-topics.ts
```
Expected: prompts 2곳 + extract-topics 1곳

**Step 6: 커밋**

```bash
git add scripts/prompts/topics.ts scripts/extract-topics.ts
git commit -m "feat: 주제 적합성 필터 (aiRelevanceScore < 0.5 거부)"
```

---

## Task 10: hasTrustedPrimary 하한선

**Files:**
- Modify: `scripts/research-topic.ts:261`

**Step 1: canPublish 조건에 하한선 추가**

`scripts/research-topic.ts:261`의 `hasVerifiedContent` 계산을 수정:

```typescript
// 기존:
// const hasVerifiedContent = avgConfidence >= MIN_CONFIDENCE && hasTrustedEvidence;
// 변경: hasTrustedPrimary여도 avgConfidence < 0.4이면 차단
const hasVerifiedContent = avgConfidence >= Math.max(MIN_CONFIDENCE, hasTrustedPrimary ? 0.4 : MIN_CONFIDENCE) && hasTrustedEvidence;
```

실제로는 더 명확하게:

```typescript
const hasVerifiedContent = hasTrustedEvidence && avgConfidence >= MIN_CONFIDENCE && !(hasTrustedPrimary && !hasTrustedSources && avgConfidence < 0.4);
```

**Step 2: 검증**

```bash
grep -n "hasVerifiedContent" scripts/research-topic.ts
```
Expected: 수정된 조건 확인

**Step 3: 커밋**

```bash
git add scripts/research-topic.ts
git commit -m "fix: hasTrustedPrimary bypass에 avgConfidence 0.4 하한선 추가"
```

---

## Task 11: 최종 통합 검증

**Step 1: memU 헬스 + CLIProxyAPI 확인**

```bash
curl -s http://localhost:8100/health
curl -s http://localhost:8317/v1/models | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])),'models')"
```

**Step 2: 파이프라인 dry-run**

```bash
cd /home/kkaemo/projects/aionda
# extract-topics만 dry-run (memU 체크 포함)
pnpm extract-topics --dry-run --limit 3 2>&1 | tail -20

# research-topic dry-run (memU retrieve 포함)
pnpm research-topic --dry-run --limit 1 2>&1 | tail -20
```

**Step 3: RSS 새 소스 크롤링 테스트**

```bash
pnpm crawl-rss --dry-run 2>&1 | grep -E "anthropic|meta-ai|aitimes|theverge|arxiv" | head -10
```
Expected: 새 소스에서 항목 수집 확인

**Step 4: 전체 변경 확인**

```bash
git log --oneline -10
git diff --stat HEAD~10
```

**Step 5: 메모리 파일 업데이트**

완료된 Task를 `memory/next-session-plan.md`에 체크 표시.

---

## Execution Summary

| Task | 내용 | 예상 시간 |
|------|------|----------|
| 1 | CLIProxyAPI v6.8.40 업그레이드 | 5분 |
| 2 | memU fail-close + 환경변수 | 3분 |
| 3 | Confidence calibration rubric | 5분 |
| 4 | RSS 소스 12개 추가 | 5분 |
| 5 | 비효율 소스 비활성화 | 3분 |
| 6 | extract-topics memU 중복 체크 | 5분 |
| 7 | research-topic memU retrieve | 5분 |
| 8 | 도입부 패턴 다양화 | 5분 |
| 9 | 주제 적합성 필터 | 5분 |
| 10 | hasTrustedPrimary 하한선 | 2분 |
| 11 | 통합 검증 | 5분 |
