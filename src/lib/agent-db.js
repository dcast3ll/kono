import { Client } from "pg"
import { env } from "../config/env.js"

function createClient() {
  if (!env.databaseUrl) {
    const error = new Error("Agent database access is not configured")
    error.code = "agent_unavailable"
    throw error
  }

  const url = new URL(env.databaseUrl)
  return new Client({
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    database: url.pathname.slice(1) || "postgres",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  })
}

export async function authenticateAgentToken(tokenHash) {
  const client = createClient()
  await client.connect()
  try {
    const { rows } = await client.query(
      `update public.agent_tokens
       set last_used_at = now()
       where token_hash = $1 and revoked_at is null
       returning id, user_id, scopes`,
      [tokenHash],
    )
    return rows[0] ?? null
  } finally {
    await client.end().catch(() => {})
  }
}

export async function withUserContext(userId, callback) {
  const client = createClient()
  await client.connect()
  try {
    await client.query("begin")
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated" }),
    ])
    await client.query("set local role authenticated")
    const result = await callback(client)
    await client.query("commit")
    return result
  } catch (error) {
    await client.query("rollback").catch(() => {})
    throw error
  } finally {
    await client.end().catch(() => {})
  }
}
