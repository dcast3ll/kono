import test from "node:test"
import assert from "node:assert/strict"
import {
  hashPin,
  verifyPin,
  signUnlockToken,
  verifyUnlockToken,
} from "../src/lib/crypto.js"
import { notePayloadSchema } from "../src/schemas/notes.js"
import { agentNoteIngestSchema } from "../src/schemas/agent.js"
import { generateAgentToken, hashAgentToken } from "../src/lib/tokens.js"

test("pin hash roundtrip", async () => {
  const hash = await hashPin("1234")
  assert.match(hash, /^scrypt\$/)
  assert.equal(await verifyPin("1234", hash), true)
  assert.equal(await verifyPin("0000", hash), false)
  assert.equal(await verifyPin("1234", null), false)
})

test("unlock token roundtrip, tampering and expiry", () => {
  const secret = "test-secret"
  const token = signUnlockToken({ userId: "user-1", secret, ttlSeconds: 60 })

  assert.equal(verifyUnlockToken(token, secret).sub, "user-1")
  assert.equal(verifyUnlockToken(token, "other-secret"), null)
  assert.equal(verifyUnlockToken(`${token}x`, secret), null)

  const expired = signUnlockToken({ userId: "user-1", secret, ttlSeconds: -1 })
  assert.equal(verifyUnlockToken(expired, secret), null)
})

test("note payload accepts valid types", () => {
  const idea = notePayloadSchema.parse({
    type: "IDEA",
    note_date: "2026-11-09",
    content: { text: "hola" },
  })
  assert.equal(idea.type, "IDEA")

  const checklist = notePayloadSchema.parse({
    type: "CHECKLIST",
    note_date: "2026-11-09",
    content: [{ text: "uno" }],
  })
  assert.equal(checklist.content.length, 1)

  const agentNote = notePayloadSchema.parse({
    type: "AGENT",
    note_date: "2026-11-09",
    content: { text: "news", agent: "instinct", model: "test" },
  })
  assert.equal(agentNote.content.agent, "instinct")
})

test("note payload rejects invalid payloads", () => {
  assert.throws(() =>
    notePayloadSchema.parse({
      type: "WORK",
      note_date: "2026-11-09",
      content: { task: "x", duration_mins: -1 },
    }),
  )
  assert.throws(() =>
    notePayloadSchema.parse({
      type: "CHECKLIST",
      note_date: "2026-11-09",
      content: [],
    }),
  )
  assert.throws(() =>
    notePayloadSchema.parse({
      type: "IDEA",
      note_date: "09/11/2026",
      content: { text: "fecha mal" },
    }),
  )
  assert.throws(() => notePayloadSchema.parse({ type: "AGENT", note_date: "2026-11-09", content: {} }))
})

test("agent tokens are prefixed and hashed", () => {
  const token = generateAgentToken()
  assert.match(token, /^kono_agent_[A-Za-z0-9_-]{40,}$/)
  const hash = hashAgentToken(token)
  assert.equal(hash.length, 64)
  assert.equal(hashAgentToken(token), hash)
  assert.notEqual(hashAgentToken(generateAgentToken()), hash)
})

test("agent ingest payload accepts text and optional metadata", () => {
  const payload = agentNoteIngestSchema.parse({
    text: "hello",
    agent: "instinct",
    model: "test-model",
  })
  assert.equal(payload.agent, "instinct")
  assert.throws(() => agentNoteIngestSchema.parse({ text: "" }))
})
