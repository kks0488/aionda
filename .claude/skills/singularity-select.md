# singularity-select

Select posts from crawled data for blog publication.

## Task

Present available posts from `data/raw/` and help user select which ones to process for the blog.

## Instructions

1. **Load available posts**
   - Read all JSON files from `data/raw/`
   - Exclude posts already in `data/selected/`
   - Parse and collect metadata

2. **Display post list**
   - Show posts in a formatted table:
     ```
     ID      | Category    | Title                        | Views | Likes | Date
     --------|-------------|------------------------------|-------|-------|----------
     123456  | 정보/뉴스   | GPT-5 성능 분석...           | 2345  | 89    | 01.10
     123457  | AI활용      | Claude 프롬프트 팁...        | 1234  | 56    | 01.09
     ```
   - Sort by parameter (default: date desc)

3. **Get user selection**
   - Use AskUserQuestion to present options
   - Allow multiple selection
   - Show post preview if requested

4. **Move selected posts**
   - Copy selected posts to `data/selected/`
   - Add selection metadata:
     - selectedAt: timestamp
     - selectedBy: "manual"
     - priority: ask user (high/medium/low)
     - suggestedTags: auto-suggest based on content

5. **Report selection**
   - List selected posts
   - Show next steps

## Parameters

- `filter`: Category filter (optional)
- `sort`: Sort by "date", "views", or "likes" (default: date)
- `limit`: Max posts to show (default: 20)

## Output

- Summary of selected posts
- Next step: `/singularity-verify` to verify selected posts

## Example Usage

```
/singularity-select
/singularity-select filter=정보/뉴스 sort=likes
```
