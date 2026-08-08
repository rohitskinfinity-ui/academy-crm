import { z } from "zod";

const enrollmentStatus = z.enum([
  "active",
  "completed",
  "cancelled",
  "suspended",
]);
const enrollmentOrigin = z.enum(["catalog", "custom"]);
const treatmentStage = z.enum([
  "theory",
  "observation",
  "training",
  "hands-on",
]);

export const listEnrollmentsQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  course_id: z.string().uuid().optional(),
  status: enrollmentStatus.optional(),
  search: z.string().optional(),
  type: z.enum(["course", "workshop"]).optional(),
  board_status: z.enum(["pending", "active", "all"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const enrollmentTreatmentSchema = z.object({
  treatment_id: z.string().uuid(),
  sort_order: z.number().int().default(0),
  hands_on_included: z.boolean().default(true),
});

export const createEnrollmentSchema = z.object({
  user_id: z.string().uuid(),
  course_id: z.string().uuid().nullable().optional(),
  workshop_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  origin: enrollmentOrigin.default("catalog"),
  status: enrollmentStatus.default("active"),
  agreed_price: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default("INR"),
  color_token: z.string().nullable().optional(),
  batch_id: z.string().uuid().nullable().optional(),
  campus_id: z.string().uuid().nullable().optional(),
  notes_internal: z.string().nullable().optional(),
  referral_code: z.string().max(40).nullable().optional(),
  apply_referral_credit: z.boolean().optional(),
  /** If omitted and course_id set, copy from course_treatments */
  treatments: z.array(enrollmentTreatmentSchema).optional(),
});

export const patchEnrollmentSchema = z.object({
  title: z.string().min(1).optional(),
  status: enrollmentStatus.optional(),
  agreed_price: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).optional(),
  color_token: z.string().nullable().optional(),
  batch_id: z.string().uuid().nullable().optional(),
  campus_id: z.string().uuid().nullable().optional(),
  notes_internal: z.string().nullable().optional(),
  referral_code: z.string().max(40).nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
});

export const setEnrollmentTreatmentsSchema = z.object({
  treatments: z.array(enrollmentTreatmentSchema),
  agreed_price: z.number().nonnegative().nullable().optional(),
});

export const patchEnrollmentTreatmentSchema = z.object({
  sort_order: z.number().int().optional(),
  hands_on_included: z.boolean().optional(),
  current_stage: treatmentStage.optional(),
});
