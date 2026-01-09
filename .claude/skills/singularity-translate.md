# singularity-translate

Translate verified posts from Korean to English.

## Task

Translate posts in `data/verified/` from Korean to English, maintaining technical accuracy.

## Instructions

1. **Load verified posts**
   - Read posts from `data/verified/`
   - If `id` parameter provided, translate only that post
   - Skip posts that already have translation

2. **Pre-process content**
   - Identify and mark for preservation:
     - Code blocks (```)
     - Inline code (`)
     - URLs and links
     - Product names (GPT-4, Claude, etc.)
     - Company names (OpenAI, Anthropic, etc.)
     - Numbers and statistics

3. **Translate content**
   Translate title and body following guidelines:
   - Use professional, technical English
   - Apply technical glossary (see below)
   - Adapt informal Korean to professional tone
   - Add brief context for Korea-specific references

4. **Technical Glossary**
   ```
   언어모델 → Language Model
   파인튜닝 → Fine-tuning
   프롬프트 → Prompt
   토큰 → Token
   컨텍스트 → Context
   추론 → Inference
   벤치마크 → Benchmark
   할루시네이션 → Hallucination
   멀티모달 → Multimodal
   출시 → Release
   성능 → Performance
   ```

5. **Post-process**
   - Restore preserved elements
   - Verify product names unchanged
   - Check numbers accuracy

6. **Save translation**
   - Update post in `data/verified/` with:
     - title_en
     - title_ko
     - content_en
     - content_ko
     - translatedAt
     - glossaryUsed

## Parameters

- `id`: Specific post ID to translate (optional)
- `review`: Show translation for review before saving (default: false)

## Output

For each post:
- Original Korean title
- Translated English title
- Translation quality notes
- Glossary terms used

## Example Usage

```
/singularity-translate
/singularity-translate id=123456
/singularity-translate review=true
```
