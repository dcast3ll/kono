import { z } from "zod"

const email = z
  .string()
  .trim()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email")

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")

const pin = z.string().regex(/^\d{4,12}$/, "PIN must be 4 to 12 digits")

export const registerSchema = z.object({ email, password })
export const loginSchema = z.object({ email, password })

export const pinSetupSchema = z.object({ pin })
export const pinChangeSchema = z.object({ currentPin: pin, newPin: pin })
export const pinVerifySchema = z.object({
  pin: z.string().regex(/^\d{1,12}$/, "PIN must be numeric"),
})
