# singularity-crawl

Crawl posts from DC Inside "thesingularity" gallery.

## Task

Fetch and save the latest posts from the DC Inside singularity gallery to `data/raw/`.

## Instructions

1. **Check existing posts**
   - Read filenames in `data/raw/` to get list of already crawled post IDs
   - Skip posts that already exist

2. **Fetch gallery listing**
   - URL: `https://gall.dcinside.com/mgallery/board/lists?id=thesingularity`
   - Use WebFetch to get the page content
   - If page parameter provided, append `&page={page}` to URL

3. **Parse post list**
   - Extract from each row: id, title, category, author, date, views, likes, comments
   - Skip notice posts (공지)

4. **Fetch post details**
   - For each new post (not in data/raw/):
   - Fetch: `https://gall.dcinside.com/mgallery/board/view/?id=thesingularity&no={postId}`
   - Extract: full content (HTML and text), images
   - Wait 1 second between requests (rate limiting)

5. **Save posts**
   - Save each post as JSON to `data/raw/{postId}.json`
   - Include crawledAt timestamp

## Parameters

- `pages`: Number of pages to crawl (default: 1)
- `category`: Filter by category (optional, e.g., "정보/뉴스")

## Output

Report:
- Number of new posts crawled
- List of new post IDs and titles
- Any errors encountered

## Example Usage

```
/singularity-crawl
/singularity-crawl pages=3
/singularity-crawl category=정보/뉴스
```
