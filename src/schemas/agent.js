import { z } from "zod"

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")

export const agentTokenCreateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
})

export const agentNoteIngestSchema = z.object({
  text: z.string().trim().min(1).max(10000),
  title: z.string().trim().max(200).optional().nullable(),
  agent: z.string().trim().min(1).max(80).optional(),
  model: z.string().trim().max(120).optional(),
  date: date.optional(),
})

export const agentNotesQuerySchema = z.object({
  from: date.optional(),
  to: date.optional(),
  type: z.enum(["IDEA", "CHECKLIST", "WORK", "AGENT"]).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})
