import test from "node:test"
import assert from "node:assert/strict"
import {
  shiftIsoDate,
  weekStart,
  formatDisplayDate,
  formatMinutes,
  formatTime,
  isUnlockTokenFresh,
} from "../public/js/date.js"
import { konoApp } from "../public/js/app.js"

test("shiftIsoDate crosses month and year boundaries", () => {
  assert.equal(shiftIsoDate("2026-11-01", -1), "2026-10-31")
  assert.equal(shiftIsoDate("2026-12-31", 1), "2027-01-01")
  assert.equal(shiftIsoDate("2026-02-28", 1), "2026-03-01")
})

test("weekStart returns the Monday of the week", () => {
  assert.equal(weekStart("2026-11-09"), "2026-11-09")
  assert.equal(weekStart("2026-11-15"), "2026-11-09")
})

test("formatDisplayDate renders DD/MM/YYYY", () => {
  assert.equal(formatDisplayDate("2026-11-09"), "09/11/2026")
})

test("formatMinutes renders human durations", () => {
  assert.equal(formatMinutes(0), "0m")
  assert.equal(formatMinutes(45), "45m")
  assert.equal(formatMinutes(60), "1h")
  assert.equal(formatMinutes(150), "2h 30m")
})

test("formatTime uses the given timezone", () => {
  assert.equal(formatTime("2026-11-09T12:00:00Z", "UTC"), "12:00")
})

test("isUnlockTokenFresh checks exp and rejects garbage", () => {
  const fresh = Buffer.from(
    JSON.stringify({ sub: "u", exp: Math.floor(Date.now() / 1000) + 60 }),
  ).toString("base64url")
  assert.equal(isUnlockTokenFresh(`${fresh}.sig`), true)

  const expired = Buffer.from(
    JSON.stringify({ sub: "u", exp: Math.floor(Date.now() / 1000) - 60 }),
  ).toString("base64url")
  assert.equal(isUnlockTokenFresh(`${expired}.sig`), false)

  assert.equal(isUnlockTokenFresh(null), false)
  assert.equal(isUnlockTokenFresh("not-a-token"), false)
})

test("konoApp factory exposes the expected state", () => {
  const state = konoApp()
  assert.equal(state.view, "loading")
  assert.equal(typeof state.init, "function")
  assert.equal(state.editor.type, "IDEA")
  assert.ok(Array.isArray(state.notes))
})
