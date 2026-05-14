import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email" }).max(255),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(128),
  rememberMe: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

const strongPassword = z
  .string()
  .min(8, { message: "At least 8 characters" })
  .max(128)
  .regex(/[0-9]/, { message: "Must contain a number" })
  .regex(/[^A-Za-z0-9]/, { message: "Must contain a special character" });

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, { message: "Please enter your full name" }).max(100),
    organizationName: z
      .string()
      .trim()
      .max(100)
      .optional()
      .or(z.literal("")),
    email: z.string().trim().email().max(255),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(255),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
