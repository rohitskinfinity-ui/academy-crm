import { z } from "zod";

const contentStatus = z.enum(["draft", "published", "archived"]);

export const listBlogQuerySchema = z.object({
  status: contentStatus.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createBlogPostSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(200),
  excerpt: z.string().max(1000).nullable().optional(),
  body: z.string().nullable().optional(),
  image_url: z.string().max(2000).nullable().optional(),
  author_name: z.string().max(200).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  read_time_minutes: z.number().int().min(1).max(120).nullable().optional(),
  status: contentStatus.default("draft"),
  published_at: z.string().datetime().nullable().optional(),
  seo_title: z.string().max(300).nullable().optional(),
  seo_description: z.string().max(500).nullable().optional(),
});

export const updateBlogPostSchema = createBlogPostSchema.partial();

export const createBlogCategorySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
});
