import { z } from "zod";

export const submitContactSchema = z.object({
  first_name: z.string().min(1).max(120),
  last_name: z.string().max(120).nullable().optional(),
  email: z.string().email().max(320),
  phone: z.string().max(40).nullable().optional(),
  topic: z.string().max(120).nullable().optional(),
  message: z.string().min(1).max(5000),
});

export const submitNewsletterSchema = z.object({
  email: z.string().email().max(320),
});

export const submitCallbackSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(320).nullable().optional(),
  phone: z.string().min(1).max(40),
  item_title: z.string().max(300).nullable().optional(),
  item_category: z.string().max(120).nullable().optional(),
  preferred_time: z.string().max(200).nullable().optional(),
});
