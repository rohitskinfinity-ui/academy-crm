import { z } from "zod";

export const listStudentsQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const updateStudentSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  display_name: z.string().max(200).nullable().optional(),
  email: z
    .string()
    .email()
    .transform((v) => v.trim().toLowerCase())
    .optional(),
  is_active: z.boolean().optional(),
  phone: z.string().max(50).nullable().optional(),
  whatsapp: z.string().max(50).nullable().optional(),
  alternate_phone: z.string().max(50).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  address_line: z.string().max(500).nullable().optional(),
  city_state: z.string().max(200).nullable().optional(),
  pin_code: z.string().max(20).nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  gender: z.string().max(30).nullable().optional(),
  highest_qualification: z.string().max(200).nullable().optional(),
  profession: z.string().max(200).nullable().optional(),
  medical_background: z.string().max(500).nullable().optional(),
  registration_no: z.string().max(100).nullable().optional(),
  guardian_name: z.string().max(200).nullable().optional(),
  program_label: z.string().max(200).nullable().optional(),
});
