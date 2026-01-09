# singularity-publish

Generate MDX blog posts and prepare for deployment.

## Task

Generate MDX files from verified/translated posts and prepare them for the Next.js blog.

## Instructions

1. **Load translated posts**
   - Read posts from `data/verified/` that have translations
   - If `id` parameter provided, process only that post
   - Check for existing MDX files to avoid duplicates

2. **Generate slug**
   - Create URL-friendly slug from English title
   - Example: "GPT-5 Performance Analysis" → "gpt-5-performance-analysis"
   - Ensure uniqueness

3. **Create MDX frontmatter**
   ```yaml
   ---
   title: "English title"
   slug: "url-slug"
   date: "2025-01-10"
   locale: "en"  # or "ko"
   description: "SEO description (first 160 chars)"
   tags: ["tag1", "tag2"]
   author: "Singularity Blog"
   sourceId: "123456"
   sourceUrl: "https://gall.dcinside.com/..."
   verificationScore: 0.85
   verifiedAt: "2025-01-10T12:00:00Z"
   alternateLocale: "/ko/posts/url-slug"
   ogImage: "/og/url-slug.png"
   ---
   ```

4. **Format content**
   - Add main heading (# title)
   - Format body content
   - Add "Verification Notes" section if corrections exist
   - Add "Sources" section with links

5. **Generate files**
   - English: `apps/web/content/posts/en/{slug}.mdx`
   - Korean: `apps/web/content/posts/ko/{slug}.mdx`

6. **Generate OG image metadata**
   - Record OG image parameters for later generation
   - Or trigger OG image generation

7. **Report**
   - List generated files
   - Show preview URLs
   - Next steps for deployment

## Parameters

- `id`: Specific post ID to publish (optional)
- `draft`: Save as draft (not published) (default: false)
- `preview`: Show generated MDX before saving (default: false)

## Output

- List of generated MDX files
- Preview URLs for local development
- Instructions for deployment

## Example Usage

```
/singularity-publish
/singularity-publish id=123456
/singularity-publish draft=true
```

## Next Steps After Publishing

1. Run `pnpm dev` to preview locally
2. Check both English and Korean versions
3. Verify OG image at `/api/og?title=...`
4. Commit and push: `git add . && git commit -m "Add post: {title}" && git push`
5. Vercel will auto-deploy
