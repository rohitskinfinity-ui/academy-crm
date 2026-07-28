import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(6),
});

export const createAdminSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8),
  full_name: z.string().min(1).max(200),
  display_name: z.string().max(200).optional().nullable(),
  role: z.enum(["admin", "staff"]).default("staff"),
});

export const listUsersQuerySchema = z.object({
  role: z.enum(["student", "instructor", "admin", "staff"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const patchUserSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  display_name: z.string().max(200).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  role: z.enum(["student", "instructor", "admin", "staff"]).optional(),
  is_active: z.boolean().optional(),
  email: z.string().email().transform((v) => v.trim().toLowerCase()).optional(),
});
