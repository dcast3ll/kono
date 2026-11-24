// Dev-only browser smoke test. Creates a confirmed test user directly in the
// database, drives the real UI with the installed Chrome, and cleans up.
// Run with: node scripts/e2e-smoke.mjs

import fs from "node:fs"
import { Client } from "pg"
import { chromium } from "playwright-core"
import app from "../src/app.js"

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
]

const chromePath = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate))
if (!chromePath) {
  console.error("No Chrome/Edge executable found")
  process.exit(1)
}

const url = new URL(process.env.DIRECT_URL)
const db = new Client({
  host: url.hostname,
  port: Number(url.port || 5432),
  database: url.pathname.slice(1) || "postgres",
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: { rejectUnauthorized: false },
})
await db.connect()

const email = "e2e.kono.test@gmail.com"
const password = "Kono-E2E-1234"

await db.query("delete from auth.users where email = $1", [email])
const inserted = await db.query(
  `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
     confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
     phone_change, phone_change_token, reauthentication_token, email_change_confirm_status,
     created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
   values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1,
     extensions.crypt($2, extensions.gen_salt('bf')), now(), '', '', '', '', '', '', '', '', 0,
     now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
   returning id`,
  [email, password],
)
const userId = inserted.rows[0].id
await db.query(
  `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
   values ($1, $2, jsonb_build_object('sub', $3::text, 'email', $4::text), 'email', now(), now(), now())`,
  [userId, userId, userId, email],
)

let server = null
let base = process.env.E2E_BASE_URL

if (!base) {
  server = app.listen(0)
  await new Promise((resolve) => server.once("listening", resolve))
  base = `http://127.0.0.1:${server.address().port}`
}

const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const page = await browser.newPage()

const consoleErrors = []
// The initial /api/auth/me call legitimately returns 401 before login.
const ignoredConsole = [/status of 401/, /404 \(Not Found\)/]
page.on("console", (message) => {
  if (message.type() !== "error") return
  if (ignoredConsole.some((pattern) => pattern.test(message.text()))) return
  consoleErrors.push(message.text())
})
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`))

let failures = 0
function check(condition, label) {
  if (condition) {
    console.log(`  ok  ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL ${label}`)
  }
}

try {
  await page.goto(base)
  await page.waitForSelector(".auth-card", { state: "visible" })
  check(true, "auth screen renders")

  await page.fill("#auth-email", email)
  await page.fill("#auth-password", password)
  await page.click(".auth-card button[type=submit]")
  await page.waitForSelector(".date-display", { state: "visible" })
  check(true, "login reaches the app shell")

  if (base.startsWith("https://")) {
    const cookies = await page.context().cookies(base)
    const access = cookies.find((cookie) => cookie.name === "kono_access")
    check(access?.secure === true, "session cookie is Secure")
  }

  check(
    (await page.locator(".app-brand-name").textContent())?.trim() === "Kono Notes",
    "header shows the brand name",
  )
  check(
    (await page.locator(".app-brand-slogan").textContent())?.trim() === "Capture the day.",
    "header shows the slogan",
  )

  const desktopViewport = page.viewportSize() ?? { width: 1280, height: 720 }
  await page.setViewportSize({ width: 390, height: 800 })
  check(!(await page.locator(".app-brand-slogan").isVisible()), "slogan hides on mobile")
  await page.setViewportSize(desktopViewport)

  await page.click('button[title="Unlock private notes"]')
  await page.waitForSelector("#pin-input", { state: "visible" })
  await page.fill("#pin-input", "1234")
  await page.fill("#pin-confirm", "1234")
  await page.click(".modal-card button[type=submit]")
  await page.waitForSelector(".modal-layer", { state: "hidden" })
  check((await page.locator('button[title="Lock private notes"]').count()) === 1, "PIN setup unlocks the app")

  await page.fill(".composer-title", "Smoke idea")
  await page.fill(".composer textarea", "comprar cafe molido")
  await page.click('button:has-text("Add note")')
  await page.waitForSelector('.note-card.type-idea:has-text("comprar cafe molido")')
  check(true, "creates an idea note")

  await page.click('.type-tab:has-text("Agent")')
  await page.fill(".composer textarea", "agent news from e2e")
  await page.click('button:has-text("Add note")')
  await page.waitForSelector('.note-card.type-agent:has-text("agent news from e2e")')
  check(true, "creates an agent note from the UI")

  await page.click('.type-tab:has-text("Private")')
  await page.fill(".composer textarea", "secreto e2e")
  await page.click('button:has-text("Add note")')
  await page.waitForSelector('.note-card.type-private:has-text("secreto e2e")')
  check(true, "creates a private note while unlocked")

  await page.click('button[title="Lock private notes"]')
  await page.waitForSelector(".note-card.type-private .private-locked", { state: "visible" })
  check((await page.locator("text=secreto e2e").count()) === 0, "locking hides private content")

  await page.click(".private-locked")
  await page.waitForSelector("#pin-input", { state: "visible" })
  await page.fill("#pin-input", "1234")
  await page.click(".modal-card button[type=submit]")
  await page.waitForSelector(".modal-card", { state: "hidden" })
  await page.waitForSelector('.note-card.type-private:has-text("secreto e2e")')
  check(true, "unlocking reveals private content")

  await page.click('.type-tab:has-text("List")')
  await page.fill('input[placeholder="Item"]', "tarea uno")
  await page.click('button:has-text("Add item")')
  await page.locator('input[placeholder="Item"]').nth(1).fill("tarea dos")
  await page.click('button:has-text("Add note")')
  await page.waitForSelector('.note-card.type-checklist:has-text("tarea uno")')
  const checkbox = page
    .locator(".note-card.type-checklist")
    .last()
    .locator('input[type="checkbox"]')
    .first()
  await checkbox.check()
  check(await checkbox.isChecked(), "toggles a checklist item")

  await page.reload()
  await page.waitForSelector(".date-display", { state: "visible" })
  await page.waitForSelector('.note-card.type-checklist:has-text("tarea uno")')
  const persisted = page
    .locator(".note-card.type-checklist")
    .last()
    .locator('input[type="checkbox"]')
    .first()
  check(await persisted.isChecked(), "checklist state persists after reload")

  await page.click('.type-tab:has-text("Work")')
  await page.fill(".work-task-input", "reunion e2e\n- segunda linea")
  await page.locator(".duration-field input").nth(0).fill("1")
  await page.locator(".duration-field input").nth(1).fill("30")
  await page.click('button:has-text("Add note")')
  await page.waitForSelector('.note-card.type-work:has-text("reunion e2e")')
  const workText = await page.locator(".note-card.type-work .work-task").last().textContent()
  check(workText?.includes("\n"), "work task preserves line breaks")
  await page.waitForFunction(
    () => document.querySelector(".timesheet-card .display-6")?.textContent?.trim() === "1h 30m",
  )
  check(true, "timesheet totals the work note")

  await page.fill(".search-input input", "cafe")
  await page.waitForSelector('h2:has-text("Search results")', { state: "visible" })
  await page.waitForSelector('.note-card:has-text("comprar cafe molido")')
  check(true, "search finds the idea")

  const agent = await page.evaluate(async () => {
    const created = await fetch("/api/agent/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "e2e" }),
    }).then(async (response) => ({ status: response.status, body: await response.json() }))

    if (created.status !== 201) return { created }

    const auth = { authorization: `Bearer ${created.body.token}` }
    const read = await fetch("/api/agent/notes?limit=100", { headers: auth }).then(async (response) => ({
      status: response.status,
      body: await response.json(),
    }))
    const write = await fetch("/api/agent/notes", {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ text: "instinct wrote this", agent: "instinct" }),
    }).then(async (response) => ({ status: response.status, body: await response.json() }))
    const revoke = await fetch(`/api/agent/tokens/${created.body.record.id}`, { method: "DELETE" }).then((response) => response.status)
    const afterRevoke = await fetch("/api/agent/notes?limit=1", { headers: auth }).then((response) => response.status)

    return { created, read, write, revoke, afterRevoke }
  })

  check(agent.created.status === 201, "creates an agent token")
  check(agent.read?.status === 200, "agent can read notes")
  check(agent.read?.body?.notes?.every((note) => note.type !== "PRIVATE"), "agent cannot read private notes")
  check(agent.write?.status === 201 && agent.write?.body?.note?.type === "AGENT", "agent writes an agent note")
  check(agent.revoke === 200 && agent.afterRevoke === 401, "revoked agent token is rejected")

  await page.reload()
  await page.waitForSelector(".date-display", { state: "visible" })
  await page.waitForSelector('.note-card.type-agent:has-text("instinct wrote this")')
  check(true, "agent note appears in the UI")

  check(consoleErrors.length === 0, `no browser console errors (${consoleErrors.join(" | ") || "none"})`)
} catch (error) {
  failures += 1
  console.error("E2E ERROR:", error.message)
  if (consoleErrors.length) console.error("console errors:", consoleErrors.join(" | "))
} finally {
  await browser.close()
  if (server) server.close()
  await db.query("delete from auth.users where id = $1", [userId])
  await db.end()
  console.log(failures === 0 ? "E2E PASS" : `E2E FAIL (${failures})`)
  process.exitCode = failures === 0 ? 0 : 1
}
