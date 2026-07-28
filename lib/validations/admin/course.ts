import { z } from "zod";

const contentStatus = z.enum(["draft", "published", "archived"]);
const courseLevel = z.enum(["beginner", "intermediate", "advanced"]);
const courseMode = z.enum(["online", "offline", "hybrid"]);

export const listCoursesQuerySchema = z.object({
  status: contentStatus.optional(),
  category_id: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createCategorySchema = z.object({
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  icon: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createCourseSchema = z.object({
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  duration_label: z.string().nullable().optional(),
  mode: courseMode.nullable().optional(),
  level: courseLevel.nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  list_price: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default("INR"),
  rating: z.number().min(0).max(5).nullable().optional(),
  certificate_label: z.string().nullable().optional(),
  faculty_lead_id: z.string().uuid().nullable().optional(),
  tag: z.string().nullable().optional(),
  is_bestseller: z.boolean().default(false),
  is_customizable: z.boolean().default(true),
  status: contentStatus.default("draft"),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
  color_token: z.string().nullable().optional(),
  published_at: z.string().datetime().nullable().optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

export const setCourseTreatmentsSchema = z.object({
  treatments: z.array(
    z.object({
      treatment_id: z.string().uuid(),
      sort_order: z.number().int().default(0),
      hands_on_default: z.boolean().default(true),
    }),
  ),
});

export const createCampusSchema = z.object({
  name: z.string().min(1),
  city: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});

export const createBatchSchema = z.object({
  course_id: z.string().uuid().nullable().optional(),
  campus_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  starts_on: z.string().nullable().optional(),
  ends_on: z.string().nullable().optional(),
  training_mode: courseMode.nullable().optional(),
  seats_total: z.number().int().nullable().optional(),
  seats_left: z.number().int().nullable().optional(),
  is_active: z.boolean().default(true),
});
