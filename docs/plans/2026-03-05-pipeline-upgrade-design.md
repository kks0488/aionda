# aionda Pipeline Upgrade Design

> 2026-03-05 | memU 전면 통합 + CLIProxyAPI 단일 게이트웨이 + 소스 확장 + 품질 강화

## 1. 현재 문제 요약

### 1.1 memU 미활용 (전체 기능의 10%만 사용)
- write-article에서만 중복 체크 → 459건 전부 체크 없이 발행됨 (fail-open)
- `retrieve()` 함수: export만 되어 있고 호출처 0건 (dead code)
- extract-topics, research-topic에서 memU 미사용 → 중복 토픽, 리서치 캐싱 없음

### 1.2 AI 호출 경로 분산
- 텍스트: CLIProxyAPI → Codex OAuth (정상)
- 이미지: OPENAI_IMAGE_API_KEY 직접 (만료)
- Gemini: GEMINI_API_KEY 직접 (만료)
- API 키 3개 관리 필요, 2개 만료 상태

### 1.3 소스 다양성 부족
- 26개 RSS 중 AI 전문 소스 절반 이하
- Anthropic, Meta AI 블로그 누락 (6대 AI 기업 중 2개)
- 한국 AI 전문 매체 0개 (AI타임스 등)
- 논문/리서치 채널 0개 (arXiv, HF Papers)
- 독립 분석가 채널 0개

### 1.4 파이프라인 정밀도
- confidence: 52.1%가 정확히 0.95 → calibration rubric 부재
- 도입부: 10편 중 8편 동일 "장면 묘사" 패턴
- 주제 이탈: AI 무관 글 발행 (필터 부재)
- 같은 이벤트에서 3편 발행 (중복 감지 약함)

---

## 2. 설계 원칙

1. **CLIProxyAPI = 단일 AI 게이트웨이**: 모든 AI 호출을 CLIProxyAPI(localhost:8317)로 통일. 직접 API 키 의존성 0개.
2. **memU = 파이프라인의 기억**: 모든 단계에서 memU를 참조하고 결과를 저장. fail-close 기본.
3. **로컬 임베딩 유지**: fastembed:8201은 API 키 불필요, 성능 우수. 그대로 유지.
4. **점진적 적용**: Phase별로 독립 배포 가능하게 설계.

---

## 3. 아키텍처

### 3.1 AI 호출 경로 (통일 후)

```
aionda 파이프라인
  │
  ├── 텍스트 생성 ──→ CLIProxyAPI:8317 ──→ Codex OAuth ──→ GPT-5.2
  │
  ├── 이미지 생성 ──→ 현행 유지 (로컬 fallback), Antigravity는 향후 별도 진행
  │
  ├── 임베딩 ──────→ fastembed:8201 (로컬, API 키 불필요)
  │
  └── memU ────────→ localhost:8100
                       ├── LLM 호출 → CLIProxyAPI:8317 경유 (이미 설정됨)
                       ├── check-similar (임베딩 검색)
                       ├── memorize (LLM 구조화)
                       └── retrieve (임베딩 검색)
```

### 3.2 memU 통합 지점

```
[crawl/crawl-rss]
      │
      ▼
[extract-topics] ──→ memU.checkSimilar(topic) ──→ 유사 토픽 있으면 skip
      │                                           (threshold: 0.80)
      ▼
[research-topic] ──→ memU.retrieve(topic) ──→ 기존 리서치 결과 참조
      │                                       출처 재활용, confidence 보정
      ▼
[write-article]  ──→ memU.checkBeforePublish() ──→ fail-close (기본)
      │              memU.saveAfterPublish()    ──→ 제목+요약+태그+출처+slug 저장
      ▼
[generate-image] ──→ 현행 유지 (Antigravity 연동 시 CLIProxyAPI 경유로 전환)
```

### 3.3 memU 데이터 모델 (aionda용)

```
user_id: "aionda"

memory_type별 용도:
  "knowledge"  → 발행된 글 (제목, 요약, 태그, slug)
  "event"      → 토픽 이벤트 (날짜, 소스, 카테고리)
  "skill"      → 리서치 결과 (출처 URL, confidence, findings)

metadata 필드 활용:
  slug          → 글 식별
  tags          → 태그 배열
  sourceType    → official/news/raw
  sourceUrl     → 원본 URL
  publishedAt   → 발행일
  confidence    → 검증 점수
```

---

## 4. Phase 0: CLIProxyAPI 업데이트 (선행)

### 0.1 CLIProxyAPI v6.7.41 → v6.8.40 업그레이드

**현재**: v6.7.41 (40+ 릴리스 뒤처짐)
**목표**: v6.8.40 (2026-03-03 릴리스)

주요 변경:
- Management Web UI 내장 (v6.8.0)
- Antigravity v1.19.5: Claude 4-6 마이그레이션, Gemini 이미지 라우팅 개선
- Claude adaptive thinking 지원 (v6.8.40)
- Google One 로그인 추가 (v6.8.15)

업그레이드 절차:
```bash
cd /home/kkaemo/projects/CLIProxyAPI
# 1. 현재 config 백업
cp config.yaml config.yaml.backup

# 2. 최신 소스 가져오기
git fetch origin
git checkout v6.8.40

# 3. 빌드
go build ./cmd/server/

# 4. config.yaml 비교 후 필요시 업데이트
diff config.yaml.backup config.example.yaml

# 5. 서비스 재시작
sudo systemctl restart cliproxyapi  # 또는 수동 재시작
```

config 호환성: v6.x 내부 업그레이드이므로 breaking changes 없음. 신규 필드는 선택적.

### 0.2 업그레이드 후 검증

memU가 CLIProxyAPI 경유로 정상 동작하는지 확인:
```bash
# memU 헬스 체크
curl http://localhost:8100/health

# CLIProxyAPI 경유 LLM 호출 테스트
curl -X POST http://localhost:8317/v1/chat/completions \
  -H "Authorization: Bearer $CLIPROXY_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-5.2","messages":[{"role":"user","content":"test"}],"max_tokens":10}'
```

> Antigravity OAuth 연동 및 이미지 생성 복구는 별도 작업으로 진행. 현재는 로컬 fallback 유지.

---

## 5. Phase 1: 기반 정비 (즉시)

### 1.1 memU fail-close 강제

**파일**: `scripts/lib/memu-client.ts`, `.env.local`, `.env.example`

- `.env.local`에 `REQUIRE_MEMU_FOR_PUBLISH=true` 설정
- `.env.example`에 memU 관련 변수 문서화
- CI(auto-update.yml)에도 환경변수 추가
- memU 서버 systemd 서비스 등록 (자동 복구)

### 1.2 Confidence calibration rubric

**파일**: `scripts/lib/gemini.ts:350-378`, `scripts/lib/openai-search.ts:348-376`

프롬프트에 calibration rubric 추가:
```
confidence 기준:
- 0.95-1.0: 공식 문서에서 정확히 일치하는 문구를 찾음
- 0.85-0.94: 신뢰 출처(S/A)에서 핵심 사실을 확인함
- 0.70-0.84: 여러 출처에서 일관된 정보를 확인했으나 세부 불일치
- 0.50-0.69: 관련 정보는 있으나 직접 확인 불가
- 0.30-0.49: 약한 근거만 있음
- 0.30 미만: 확인 불가 또는 모순 정보
```

### 1.3 RSS 소스 확장 (12개 추가)

**파일**: `scripts/crawl-rss.ts`

Critical (즉시):
- Anthropic Blog (커뮤니티 RSS)
- Meta AI Research (engineering.fb.com)
- AI타임스

High:
- The Verge AI
- arXiv cs.AI
- HuggingFace Daily Papers
- Simon Willison
- Interconnects
- AI Snake Oil

Medium:
- Hacker News AI (50+ points)
- Reddit r/MachineLearning
- 전자신문

### 1.4 비효율 소스 정리

- 클라우드/보안 8개: enabled: false 또는 제거
- 한국 테크블로그 6개: AI 기여도 기준 재평가

---

## 6. Phase 2: memU 파이프라인 통합 + CLIProxyAPI (1주)

### 2.1 extract-topics에 memU 중복 체크

**파일**: `scripts/extract-topics.ts`

토픽 추출 후, 발행 전에 memU.checkSimilar() 호출:
```typescript
const similar = await checkSimilar(topic.title + ' ' + topic.description, 'aionda', 0.80);
if (similar.is_similar) {
  log(`[SKIP] 유사 토픽 존재: ${similar.similar_items[0].summary} (score: ${similar.similarity_score})`);
  continue;
}
```

같은 배치 내 중복도 방지:
```typescript
// 배치 내에서 이미 추출된 토픽과도 비교
const batchSimilar = await checkSimilar(topic.title, 'aionda-batch', 0.85);
```

### 2.2 research-topic에 memU retrieve 연동

**파일**: `scripts/research-topic.ts`

리서치 시작 전 기존 관련 리서치 결과 참조:
```typescript
const existingResearch = await retrieve(topic.title, 'aionda', 3);
if (existingResearch.items.length > 0) {
  // 기존 출처를 초기 소스 목록에 추가
  // 기존 findings를 컨텍스트로 제공
  // confidence 보정에 활용
}
```

리서치 완료 후 결과 저장:
```typescript
await memorize(
  `[Research] ${topic.title}\n${findings.map(f => f.summary).join('\n')}`,
  'aionda',
  { slug, sourceType, confidence: avgConfidence, sources: trustedSources }
);
```

### 2.3 도입부 패턴 다양화

**파일**: `scripts/prompts/topics.ts`

5가지 도입부 유형 정의 + 배치 내 랜덤 분배:
- A: 데이터/수치 ("3,200만 달러...")
- B: 질문 ("LLM이 표적을 올리면, 자율무기인가?")
- C: 인용 ("다리오 아모데이는 이것을 'straight up lies'라고 불렀다.")
- D: 반직관적 진술 ("더 안전한 모델이 더 위험한 계약을 가져올 수 있다.")
- E: 맥락 대비 ("2024년에는 선언으로 충분했다. 2026년에는 계약서가 더 세다.")
- F: 장면 묘사 (배치당 최대 1편)

### 2.4 주제 적합성 필터 + 동일 이벤트 제한

**파일**: `scripts/extract-topics.ts`

- AI 관련도 점수 0.5 미만 → 스킵
- 같은 이벤트/소스에서 2편 이상 → 가장 높은 점수 1편만 선택

---

## 7. Phase 3: 고도화 (중기)

### 3.1 vertexaisearch URL 정규화

**파일**: 신규 `scripts/lib/url-normalize.ts` 또는 기존 search-mode.ts

`vertexaisearch.cloud.google.com` redirect를 따라가서 원본 URL 추출 → 정확한 Tier 분류.

### 3.2 hasTrustedPrimary 하한선

**파일**: `scripts/research-topic.ts:257-261`

```typescript
// 기존: hasTrustedPrimary만으로 canPublish=true
// 변경: avgConfidence < 0.4이면 hasTrustedPrimary여도 차단
const canPublish = hasTrustedEvidence && avgConfidence >= 0.4;
```

### 3.3 구조 변주

**파일**: `scripts/prompts/topics.ts`

배치당 1편은 다른 형식 사용:
- "5분 브리핑" (글머리 기호 중심, 1500자)
- "Before/After" 비교
- "오해 vs 사실" 반박
- 딥다이브 (현재 포맷)

### 3.4 "추가 확인 필요" → 구체적 출처로 치환

**파일**: `scripts/prompts/topics.ts` polish 규칙

"추가 확인 필요" 사용 시 반드시 구체적 확인처를 명시하도록 프롬프트 강화.
사용 불가 시 해당 문장 자체를 삭제.

### 3.5 GEO/AEO용 FAQ JSON-LD

**파일**: `apps/web/` 레이아웃/컴포넌트

FAQ 섹션을 FAQPage schema로 마크업 → AI 검색엔진 인용 소스 최적화.

### 3.6 memU 트렌드 분석

주기적으로 memU 데이터 분석:
- 많이 다룬 주제/태그 → extract-topics에서 가중치 감소
- 부족한 카테고리 → 해당 소스 우선 수집
- 주간 리포트 자동 생성

### 3.7 Published 레코드 sourceType 전파

**파일**: `scripts/write-article.ts`

published JSON 저장 시 `sourceType: topic.sourceType` 포함.

---

## 8. 환경변수 정리

### .env.local (변경 후)

```env
# AI Gateway (CLIProxyAPI 단일 경로)
AI_TEXT_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8317/v1
OPENAI_API_KEY=sk-8BQ...  # CLIProxyAPI 인증
OPENAI_MODEL=gpt-5.2

# Image (현행 유지, Antigravity 연동 시 전환)
IMAGE_PROVIDER=openai  # → cliproxy로 전환 예정
# OPENAI_IMAGE_API_KEY=...  # 만료 상태, 현재 로컬 fallback 사용

# memU (fail-close, LLM은 CLIProxyAPI 경유)
MEMU_API_URL=http://localhost:8100
REQUIRE_MEMU_FOR_PUBLISH=true
MEMU_TIMEOUT_MS=30000

# Embedding (로컬, API 키 불필요)
# fastembed:8201 — memU 내부에서 사용
```

---

## 9. 리스크 및 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| CLIProxyAPI 다운 | 텍스트 생성 + memU LLM 중단 | systemd 서비스 + 헬스체크 |
| CLIProxyAPI 업그레이드 실패 | 기존 v6.7.41로 롤백 | config.yaml.backup 보존 |
| memU 서버 다운 | 발행 차단 (fail-close) | systemd 서비스 + 자동 재시작 |
| RSS 소스 추가 → 토픽 폭증 | 처리 시간 초과 | MAX_TOPICS_PER_RUN 제한 유지 |
| 새 소스의 노이즈 | 저품질 토픽 증가 | AI 관련도 필터 + confidence gate |

---

## 10. 성공 기준

| 지표 | 현재 | 목표 |
|------|------|------|
| memU 중복 체크 통과율 | 0% (전수 미체크) | 100% (fail-close) |
| 유사 슬러그 쌍 | 20+ | 0 |
| Confidence 0.95 비율 | 52.1% | < 15% |
| 도입부 "장면 묘사" 비율 | 80% | < 20% |
| AI 전문 RSS 소스 | 6개 | 18개 |
| CLIProxyAPI 버전 | v6.7.41 | v6.8.40 |
