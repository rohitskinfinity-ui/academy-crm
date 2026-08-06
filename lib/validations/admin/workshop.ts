import { z } from "zod";
import { COURSE_DELIVERY_MODES } from "@/lib/courseDeliveryModes";

const contentStatus = z.enum(["draft", "published", "archived"]);

const workshopProcedureSchema = z.object({
  name: z.string().min(1).max(200),
  image_url: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export const listWorkshopsQuerySchema = z.object({
  status: contentStatus.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createWorkshopSchema = z.object({
  slug: z.string().min(1).max(160),
  title: z.string().min(1).max(300),
  tagline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  eligibility_html: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  starts_on: z.string().min(1),
  ends_on: z.string().nullable().optional(),
  duration_label: z.string().nullable().optional(),
  locations: z.string().nullable().optional(),
  delivery_modes: z.array(z.enum(COURSE_DELIVERY_MODES)).default([]),
  features: z.array(z.string()).default([]),
  procedures: z.array(workshopProcedureSchema).default([]),
  seats_total: z.number().int().min(0).nullable().optional(),
  seats_left: z.number().int().min(0).nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default("INR"),
  contact_phone: z.string().nullable().optional(),
  status: contentStatus.default("draft"),
  is_published: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  published_at: z.string().datetime().nullable().optional(),
});

export const updateWorkshopSchema = createWorkshopSchema.partial();

export type CreateWorkshopInput = z.infer<typeof createWorkshopSchema>;
export type UpdateWorkshopInput = z.infer<typeof updateWorkshopSchema>;
