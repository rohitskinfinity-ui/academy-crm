import { z } from "zod";

const contentStatus = z.enum(["draft", "published", "archived"]);
const treatmentStage = z.enum([
  "theory",
  "observation",
  "training",
  "hands-on",
]);
const videoKind = z.enum(["lecture", "ai_procedure", "clinical"]);

const optionalUrl = z
  .union([z.string().url(), z.literal("")])
  .nullable()
  .optional()
  .transform((val) => (val === "" ? null : val));

export const listTreatmentsQuerySchema = z.object({
  status: contentStatus.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createTreatmentSchema = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  summary: z.string().nullable().optional(),
  image_url: optionalUrl,
  status: contentStatus.default("draft"),
  sort_order: z.number().int().default(0),
  base_price: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default("INR"),
});

export const updateTreatmentSchema = createTreatmentSchema.partial();

export const upsertStageSchema = z.object({
  stage: treatmentStage,
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  checklist: z.array(z.string()).default([]),
  sort_order: z.number().int().default(0),
});

export const createVideoSchema = z.object({
  stage: treatmentStage.default("theory"),
  title: z.string().min(1),
  kind: videoKind.default("lecture"),
  duration_seconds: z.number().int().nonnegative().nullable().optional(),
  video_url: optionalUrl,
  thumbnail_url: optionalUrl,
  instructor_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().default(0),
  is_published: z.boolean().default(true),
});

export const updateVideoSchema = createVideoSchema.partial();

export const createBookletSchema = z.object({
  stage: treatmentStage.default("theory"),
  name: z.string().min(1),
  file_url: optionalUrl,
  drive_url: optionalUrl,
  size_bytes: z.number().int().nonnegative().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export const updateBookletSchema = createBookletSchema.partial();

export const upsertQuizSchema = z.object({
  title: z.string().min(1).default("Theory quiz"),
  pass_percent: z.number().min(0).max(100).default(66),
  is_required: z.boolean().default(true),
});

export const createQuestionSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string()).min(2),
  correct_index: z.number().int().min(0),
  explanation: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export const updateQuestionSchema = createQuestionSchema.partial();
