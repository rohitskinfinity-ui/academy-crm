import { z } from "zod";

export const videoProgressSchema = z.object({
  position_seconds: z.number().nonnegative(),
  watched_percent: z.number().min(0).max(100),
  is_completed: z.boolean().optional(),
});

export const quizSubmitSchema = z.object({
  answers: z.record(z.string().uuid(), z.number().int().nonnegative()),
});

export const finalQuizSubmitSchema = quizSubmitSchema;

export const createBookmarkSchema = z.object({
  enrollment_id: z.string().uuid().nullable().optional(),
  treatment_id: z.string().uuid(),
  video_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(300),
  module_label: z.string().max(100).nullable().optional(),
  timestamp_seconds: z.number().int().nonnegative().nullable().optional(),
});

const emptyToNull = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export const patchProfileSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  display_name: z.string().max(120).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  phone: z.preprocess(emptyToNull, z.string().max(50).nullable().optional()),
  whatsapp: z.preprocess(emptyToNull, z.string().max(50).nullable().optional()),
  alternate_phone: z.preprocess(
    emptyToNull,
    z.string().max(50).nullable().optional(),
  ),
  location: z.preprocess(emptyToNull, z.string().max(200).nullable().optional()),
  address_line: z.preprocess(
    emptyToNull,
    z.string().max(500).nullable().optional(),
  ),
  city_state: z.preprocess(emptyToNull, z.string().max(200).nullable().optional()),
  pin_code: z.preprocess(emptyToNull, z.string().max(20).nullable().optional()),
  date_of_birth: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .nullable()
      .optional(),
  ),
  gender: z.preprocess(
    emptyToNull,
    z
      .enum(["female", "male", "other", "prefer_not_to_say"])
      .nullable()
      .optional(),
  ),
  guardian_name: z.preprocess(
    emptyToNull,
    z.string().max(200).nullable().optional(),
  ),
  highest_qualification: z.preprocess(
    emptyToNull,
    z.string().max(200).nullable().optional(),
  ),
  profession: z.preprocess(emptyToNull, z.string().max(200).nullable().optional()),
  medical_background: z.preprocess(
    emptyToNull,
    z.enum(["yes", "no"]).nullable().optional(),
  ),
  currently_working: z.preprocess(
    emptyToNull,
    z.enum(["yes", "no"]).nullable().optional(),
  ),
  registration_no: z.preprocess(
    emptyToNull,
    z.string().max(100).nullable().optional(),
  ),
  program_label: z.preprocess(
    emptyToNull,
    z.string().max(200).nullable().optional(),
  ),
});

export const liveReminderSchema = z.object({
  reminded: z.boolean().optional(),
});
