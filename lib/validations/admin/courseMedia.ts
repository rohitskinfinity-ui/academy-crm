import { z } from "zod";

export const createCourseMediaSchema = z.object({
  kind: z.enum(["image", "video"]),
  url: z.string().min(1, "URL is required"),
  thumbnail_url: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  mime_type: z.string().nullable().optional(),
});

export const updateCourseMediaSchema = z.object({
  url: z.string().min(1).optional(),
  thumbnail_url: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  mime_type: z.string().nullable().optional(),
});

export const reorderCourseMediaSchema = z.object({
  ordered_ids: z.array(z.string().uuid()).min(1),
});

export type CreateCourseMediaInput = z.infer<typeof createCourseMediaSchema>;
export type UpdateCourseMediaInput = z.infer<typeof updateCourseMediaSchema>;
