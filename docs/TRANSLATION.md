# Translation Guidelines

This document describes the Korean to English translation process for blog posts.

## Overview

The translation system:
1. Preserves technical accuracy and terminology
2. Maintains code blocks, URLs, and product names
3. Adapts informal Korean to professional English
4. Adds context for Korea-specific references

## Translation Principles

### 1. Technical Accuracy First

Always prioritize technical correctness over stylistic preferences.

**Bad Translation**:
```
KO: "이 모델은 멀티모달 기능을 지원합니다"
EN: "This model supports many different types of input" ❌
```

**Good Translation**:
```
KO: "이 모델은 멀티모달 기능을 지원합니다"
EN: "This model supports multimodal capabilities" ✓
```

### 2. Preserve Technical Terms

Keep established technical terms in their standard form.

| Korean | English | Notes |
|--------|---------|-------|
| 언어모델 | Language Model | Not "word model" |
| 파인튜닝 | Fine-tuning | Standard ML term |
| 프롬프트 | Prompt | Keep as-is |
| 임베딩 | Embedding | Technical term |
| 토큰 | Token | Standard term |
| 할루시네이션 | Hallucination | AI-specific meaning |
| 컨텍스트 | Context | Keep technical meaning |
| 추론 | Inference | In ML context |

### 3. Keep Product Names

Never translate product or company names.

```
KO: "오픈AI의 GPT-4o를 사용했습니다"
EN: "I used OpenAI's GPT-4o" ✓
EN: "I used Open Artificial Intelligence's GPT-4o" ❌
```

### 4. Adapt Tone

Transform informal Korean into professional English.

**Korean (informal)**:
```
ㄹㅇ 이번 업데이트 미쳤음 ㅋㅋㅋ 성능 ㄷㄷ
```

**English (professional)**:
```
This update is truly impressive. The performance improvements are remarkable.
```

## Glossary

### AI/ML Terms

| Korean | English |
|--------|---------|
| 인공지능 | Artificial Intelligence (AI) |
| 기계학습 | Machine Learning (ML) |
| 딥러닝 | Deep Learning |
| 신경망 | Neural Network |
| 대규모 언어모델 | Large Language Model (LLM) |
| 생성형 AI | Generative AI |
| 강화학습 | Reinforcement Learning |
| 지도학습 | Supervised Learning |
| 비지도학습 | Unsupervised Learning |
| 트랜스포머 | Transformer |
| 어텐션 | Attention |
| 레이어 | Layer |
| 가중치 | Weights |
| 파라미터 | Parameters |
| 에폭 | Epoch |
| 배치 | Batch |
| 학습률 | Learning Rate |

### Technical Specs

| Korean | English |
|--------|---------|
| 컨텍스트 길이 | Context Length |
| 토큰 제한 | Token Limit |
| 응답 시간 | Response Time |
| 처리량 | Throughput |
| 지연시간 | Latency |
| 정확도 | Accuracy |
| 벤치마크 | Benchmark |
| 성능 | Performance |

### Business Terms

| Korean | English |
|--------|---------|
| 무료 | Free |
| 유료 | Paid |
| 구독 | Subscription |
| 요금제 | Pricing Plan |
| 출시 | Release |
| 업데이트 | Update |
| 발표 | Announcement |
| 기업용 | Enterprise |
| 개인용 | Personal/Consumer |

### Korean Slang → English

| Korean | Meaning | English |
|--------|---------|---------|
| ㄹㅇ | Really | truly, genuinely |
| ㄷㄷ | Impressive/Scary | impressive, remarkable |
| ㅋㅋ | Laughter | (omit or use "interestingly") |
| 미쳤다 | Amazing/Crazy | impressive, remarkable |
| 갓 | God-tier | excellent, outstanding |
| 존나 | Very (vulgar) | very, extremely |
| 레전드 | Legend | legendary, exceptional |

## Preservation Rules

### Code Blocks

Always preserve code exactly as-is:

```
KO: "다음 코드를 실행하세요: `pip install anthropic`"
EN: "Run the following code: `pip install anthropic`"
```

### URLs and Links

Keep all URLs unchanged:

```
KO: "자세한 내용은 https://anthropic.com 참고"
EN: "For more details, see https://anthropic.com"
```

### Numbers and Statistics

Preserve numbers, only translate surrounding text:

```
KO: "MMLU에서 92.5%를 달성했습니다"
EN: "It achieved 92.5% on MMLU"
```

### Product Names

Never translate:
- Model names: GPT-4, Claude, Gemini, Llama
- Company names: OpenAI, Anthropic, Google, Meta
- Service names: ChatGPT, Claude.ai, Copilot
- Benchmark names: MMLU, HumanEval, GSM8K

## Context Addition

### Korea-Specific References

Add brief explanations for Korean context:

```
KO: "네이버에서 하이퍼클로바X를 발표했습니다"
EN: "Naver (Korea's largest search engine) announced HyperCLOVA X"
```

```
KO: "카카오톡에 AI가 도입됩니다"
EN: "AI will be integrated into KakaoTalk (Korea's dominant messaging app)"
```

### Cultural Context

Explain when necessary:

```
KO: "갤러리에서 핫한 주제"
EN: "A trending topic in the online community"
(Note: "갤러리" refers to DC Inside forums)
```

## Translation Workflow

### Step 1: Pre-processing

```typescript
function preprocess(content: string) {
  // Extract and mark code blocks
  const codeBlocks = extractCodeBlocks(content);

  // Extract and mark URLs
  const urls = extractUrls(content);

  // Mark product names
  const productNames = identifyProductNames(content);

  return {
    content: replaceWithPlaceholders(content, [...codeBlocks, ...urls, ...productNames]),
    preserved: { codeBlocks, urls, productNames }
  };
}
```

### Step 2: Translation

```typescript
async function translate(preprocessed: PreprocessedContent) {
  const prompt = `
Translate the following Korean tech/AI content to English.

Guidelines:
- Use professional, technical English
- Preserve all placeholders exactly
- Apply the technical glossary
- Add brief context for Korea-specific references

Content:
${preprocessed.content}

Glossary:
${GLOSSARY_JSON}
`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}
```

### Step 3: Post-processing

```typescript
function postprocess(translated: string, preserved: PreservedContent) {
  let result = translated;

  // Restore code blocks
  for (const [placeholder, code] of preserved.codeBlocks) {
    result = result.replace(placeholder, code);
  }

  // Restore URLs
  for (const [placeholder, url] of preserved.urls) {
    result = result.replace(placeholder, url);
  }

  // Verify product names
  for (const name of preserved.productNames) {
    if (!result.includes(name)) {
      console.warn(`Product name may be mistranslated: ${name}`);
    }
  }

  return result;
}
```

## Quality Checklist

Before finalizing translation:

- [ ] All code blocks preserved exactly
- [ ] All URLs are intact and clickable
- [ ] Product/company names unchanged
- [ ] Technical terms use standard English equivalents
- [ ] Numbers and statistics accurate
- [ ] No Korean characters remaining (except in quotes)
- [ ] Tone is professional and clear
- [ ] Korea-specific references have context
- [ ] Grammar and spelling checked
- [ ] Meaning accurately conveyed

## Example Translation

### Original Korean Post

```
제목: GPT-5 성능 ㄹㅇ 미쳤음

오늘 오픈AI에서 GPT-5 벤치마크 발표함

주요 내용:
- MMLU 97.3% 달성 (GPT-4는 86.4%)
- 컨텍스트 길이 100만 토큰
- 멀티모달 ㄷㄷ

사용해보니까 추론 속도도 빨라짐. 자세한 건
https://openai.com/gpt-5 참고

`pip install openai --upgrade` 로 업데이트 가능
```

### Translated English Post

```
Title: GPT-5 Performance is Truly Impressive

OpenAI announced GPT-5 benchmarks today.

Key highlights:
- Achieved 97.3% on MMLU (compared to 86.4% for GPT-4)
- Context length of 1 million tokens
- Remarkable multimodal capabilities

Initial testing shows improved inference speed as well. For details, see
https://openai.com/gpt-5

Update available via `pip install openai --upgrade`
```
