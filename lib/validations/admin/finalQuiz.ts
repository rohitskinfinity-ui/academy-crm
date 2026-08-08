import { z } from "zod";
import { CERT_FINAL_QUIZ_PASS_PERCENT } from "@/lib/certificates/constants";

export const upsertFinalQuizSchema = z.object({
  title: z.string().min(1).default("Certificate quiz"),
  pass_percent: z.number().min(0).max(100).default(CERT_FINAL_QUIZ_PASS_PERCENT),
  is_published: z.boolean().default(true),
});

export const createFinalQuizQuestionSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string()).min(2),
  correct_index: z.number().int().min(0),
  explanation: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
});

export const updateFinalQuizQuestionSchema =
  createFinalQuizQuestionSchema.partial();
