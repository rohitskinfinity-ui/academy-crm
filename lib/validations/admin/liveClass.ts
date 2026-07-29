import { z } from "zod";

export const liveClassSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  course_id: z.string().uuid().nullable().optional(),
  treatment_id: z.string().uuid().nullable().optional(),
  platform: z.enum(["zoom", "google_meet"]).default("zoom"),
  meeting_url: z.string().min(1, "Meeting URL is required"),
  meeting_id: z.string().nullable().optional(),
  passcode: z.string().nullable().optional(),
  host_start_url: z.string().nullable().optional(),
  drive_url: z.string().nullable().optional(),
  instructor_name: z.string().min(1, "Instructor name is required").default("Senior Faculty Doctor"),
  starts_at: z.string().min(1, "Scheduled date/time is required"),
  duration_minutes: z.number().int().min(15).default(60),
  status: z.enum(["scheduled", "live", "completed", "cancelled"]).default("scheduled"),
});

export type LiveClassInput = z.infer<typeof liveClassSchema>;
