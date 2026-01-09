# singularity-verify

Verify factual claims in selected posts using AI and web search.

## Task

Fact-check claims in posts from `data/selected/` and generate verification reports in `data/verified/`.

## Instructions

1. **Load posts to verify**
   - Read posts from `data/selected/`
   - If `id` parameter provided, verify only that post
   - Skip posts already in `data/verified/`

2. **Extract claims**
   For each post, identify factual claims:
   - Release dates ("GPT-5 will release in March")
   - Benchmark scores ("achieved 97% on MMLU")
   - Pricing ("costs $20/month")
   - Features ("supports 200K context")
   - Company statements ("Sam Altman said...")
   - Technical specs ("uses MoE architecture")

3. **Verify each claim**
   For each claim:
   a. Generate search queries
   b. Use WebSearch to find sources
   c. Prioritize official sources:
      - Company blogs (openai.com, anthropic.com)
      - Official documentation
      - Press releases
      - Major tech news (techcrunch, theverge)
   d. Compare claim with found sources
   e. Assign confidence score (0-1)

4. **Generate report**
   Create verification report with:
   - List of claims and verification status
   - Sources found
   - Confidence scores
   - Suggested corrections
   - Overall score
   - Recommendation: publish / publish_with_corrections / needs_review / reject

5. **Save verified post**
   - Save to `data/verified/{postId}.json`
   - Include all verification data

## Scoring Guide

- 0.9-1.0: Verified by official source
- 0.7-0.9: Verified by reliable secondary sources
- 0.5-0.7: Partially verified
- 0.3-0.5: Conflicting information
- 0.0-0.3: Cannot verify or contradicted

## Parameters

- `id`: Specific post ID to verify (optional)
- `thorough`: Extra thorough verification (more searches) (default: false)

## Output

For each post:
- Verification summary
- Claim-by-claim results
- Overall recommendation

## Example Usage

```
/singularity-verify
/singularity-verify id=123456
/singularity-verify thorough=true
```
