import { z } from "zod"

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
const title = z.string().trim().max(200).optional().nullable()
const text = z.string().trim().min(1).max(10000)

const idea = z.object({
  type: z.literal("IDEA"),
  note_date: date,
  title,
  content: z.object({ text }),
})

const privateNote = z.object({
  type: z.literal("PRIVATE"),
  note_date: date,
  title,
  content: z.object({ text }),
})

const checklistItem = z.object({
  id: z.string().min(1).max(64).optional(),
  text: z.string().trim().min(1).max(500),
  done: z.boolean().optional(),
})

const checklist = z.object({
  type: z.literal("CHECKLIST"),
  note_date: date,
  title,
  content: z.array(checklistItem).min(1).max(200),
})

const work = z.object({
  type: z.literal("WORK"),
  note_date: date,
  title,
  content: z.object({
    task: z.string().trim().min(1).max(5000),
    duration_mins: z.number().int().min(1).max(24 * 60),
  }),
})

const agent = z.object({
  type: z.literal("AGENT"),
  note_date: date,
  title,
  content: z.object({
    text,
    agent: z.string().trim().min(1).max(80).optional(),
    model: z.string().trim().max(120).optional(),
  }),
})

export const notePayloadSchema = z.discriminatedUnion("type", [
  idea,
  privateNote,
  checklist,
  work,
  agent,
])

export const dateQuerySchema = z.object({ date })

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  type: z.enum(["IDEA", "PRIVATE", "CHECKLIST", "WORK", "AGENT"]).optional(),
  all: z.enum(["true", "false"]).default("false"),
  date: date.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const timesheetQuerySchema = z.object({ from: date, to: date })

export const itemPatchSchema = z.object({ done: z.boolean() })
