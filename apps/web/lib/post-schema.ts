import { z } from 'zod';

const StringArrayOrStringSchema = z.union([z.array(z.string()), z.string()]);

export const PostFrontmatterSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  date: z.string().min(1),
  locale: z.enum(['ko', 'en']),
  description: z.string().optional(),
  excerpt: z.string().optional(),
  tags: StringArrayOrStringSchema.optional(),
  author: z.string().optional(),
  byline: z.string().optional(),
  sourceId: z.string().optional(),
  sourceUrl: z.string().optional(),
  verificationScore: z.coerce.number().optional(),
  alternateLocale: z.string().optional(),
  coverImage: z.string().optional(),
  lastReviewedAt: z.string().optional(),
  primaryKeyword: z.string().optional(),
  intent: z.string().optional(),
  topic: z.string().optional(),
  schema: z
    .preprocess(
      (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
      z.enum(['faq', 'howto']).optional()
    ),
  category: z.string().optional(),
});

export type PostFrontmatter = z.infer<typeof PostFrontmatterSchema>;
