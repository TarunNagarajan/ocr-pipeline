import { z } from "zod";

export const registerSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(10)
    .max(128)
    .regex(/[A-Za-z]/, "Password must include a letter.")
    .regex(/[0-9]/, "Password must include a digit.")
});

export const loginSchema = registerSchema;

export const documentIdSchema = z.object({
  id: z.string().min(1)
});
