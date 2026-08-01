import { z } from "zod";

const gender = z.enum(["female", "male", "other", "prefer_not_to_say"]);
const yesNo = z.enum(["yes", "no"]);
const courseMode = z.enum(["online", "offline", "hybrid"]);
const paymentOption = z.enum(["deposit", "full", "callback"]);

export const submitApplicationSchema = z.object({
  full_name: z.string().min(1).max(200),
  guardian_name: z.string().max(200).nullable().optional(),
  course_preference: z.string().max(300).nullable().optional(),
  course_slug: z.string().max(120).nullable().optional(),
  course_id: z.string().uuid().nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  gender: gender.nullable().optional(),
  highest_qualification: z.string().max(200).nullable().optional(),
  profession: z.string().max(200).nullable().optional(),
  medical_background: yesNo.nullable().optional(),
  registration_no: z.string().max(120).nullable().optional(),
  currently_working: yesNo.nullable().optional(),
  whatsapp: z.string().min(1).max(40),
  alternate_no: z.string().max(40).nullable().optional(),
  email: z.string().email().max(320),
  address: z.string().max(1000).nullable().optional(),
  city_state: z.string().max(200).nullable().optional(),
  pin_code: z.string().max(20).nullable().optional(),
  source: z.string().max(120).nullable().optional(),
  preferred_campus_id: z.string().uuid().nullable().optional(),
  training_mode: courseMode.nullable().optional(),
  preferred_batch_id: z.string().uuid().nullable().optional(),
  payment_option: paymentOption.nullable().optional(),
  quoted_price: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default("INR"),
  photo_url: z.string().max(2000).nullable().optional(),
  document_url: z.string().max(2000).nullable().optional(),
  accepted_terms: z.boolean(),
});
