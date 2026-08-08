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

export const patchProfileSchema = z.object({
  display_name: z.string().max(120).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

export const liveReminderSchema = z.object({
  reminded: z.boolean().optional(),
});
