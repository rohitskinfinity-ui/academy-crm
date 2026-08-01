import { z } from "zod";

const contentStatus = z.enum(["draft", "published", "archived"]);
const testimonialType = z.enum(["text", "video"]);

export const listTestimonialsQuerySchema = z.object({
  type: testimonialType.optional(),
  status: contentStatus.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createTestimonialSchema = z.object({
  type: testimonialType.default("text"),
  person_name: z.string().min(1).max(200),
  credentials: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  course_id: z.string().uuid().nullable().optional(),
  course_label: z.string().nullable().optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
  quote: z.string().min(1),
  image_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  video_url: z.string().nullable().optional(),
  video_duration: z.string().nullable().optional(),
  video_title: z.string().nullable().optional(),
  is_featured: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  status: contentStatus.default("draft"),
  published_at: z.string().datetime().nullable().optional(),
  review_date: z.string().nullable().optional(),
});

export const updateTestimonialSchema = createTestimonialSchema.partial();
