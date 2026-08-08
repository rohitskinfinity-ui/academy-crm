import { z } from "zod";

const gender = z.enum(["female", "male", "other", "prefer_not_to_say"]);
const yesNo = z.enum(["yes", "no"]);
const courseMode = z.enum(["online", "offline", "hybrid"]);
const paymentOption = z.enum(["deposit", "full", "callback"]);
const applicationKind = z.enum(["course", "workshop"]);

export const submitApplicationSchema = z
  .object({
    application_kind: applicationKind.default("course"),
    full_name: z.string().min(1).max(200),
    guardian_name: z.string().max(200).nullable().optional(),
    course_preference: z.string().max(300).nullable().optional(),
    course_slug: z.string().max(120).nullable().optional(),
    course_id: z.string().uuid().nullable().optional(),
    workshop_id: z.string().uuid().nullable().optional(),
    workshop_slug: z.string().max(160).nullable().optional(),
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
    referral_code: z.string().max(40).nullable().optional(),
    use_referral_credit: z.boolean().optional(),
    preferred_campus_id: z.string().uuid().nullable().optional(),
    training_mode: courseMode.nullable().optional(),
    preferred_batch_id: z.string().uuid().nullable().optional(),
    payment_option: paymentOption.nullable().optional(),
    quoted_price: z.number().nonnegative().nullable().optional(),
    currency: z.string().length(3).default("INR"),
    photo_url: z.string().max(2000).nullable().optional(),
    document_url: z.string().max(2000).nullable().optional(),
    photo_name: z.string().max(260).nullable().optional(),
    photo_base64: z.string().max(12_000_000).nullable().optional(),
    doc_name: z.string().max(260).nullable().optional(),
    doc_base64: z.string().max(12_000_000).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    accepted_terms: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.application_kind === "workshop") {
      if (!data.workshop_id && !data.workshop_slug?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Workshop is required",
          path: ["workshop_slug"],
        });
      }
      return;
    }
    if (
      !data.course_id &&
      !data.course_slug?.trim() &&
      !data.course_preference?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Course is required",
        path: ["course_slug"],
      });
    }
  });
