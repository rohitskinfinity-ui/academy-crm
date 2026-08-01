import { z } from "zod";

const courseLevel = z.enum(["beginner", "intermediate", "advanced"]);

export const listPublicCoursesQuerySchema = z.object({
  category: z.string().optional(),
  level: courseLevel.optional(),
  q: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listPublicEventsQuerySchema = z.object({
  type: z
    .enum(["workshop", "live_class", "course_batch", "exam", "other"])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listPublicBlogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const listPublicTestimonialsQuerySchema = z.object({
  type: z.enum(["text", "video"]).optional(),
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
