import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Client } from "pg"
import "dotenv/config"

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url))
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL

if (!connectionString) {
  console.error("Set DIRECT_URL (session pooler) or DATABASE_URL in .env")
  process.exit(1)
}

const url = new URL(connectionString)

const client = new Client({
  host: url.hostname,
  port: url.port ? Number(url.port) : 5432,
  database: url.pathname.slice(1) || "postgres",
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: { rejectUnauthorized: false },
})

const statusOnly = process.argv.includes("--status")

async function main() {
  await client.connect()

  await client.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `)
  await client.query("alter table public.schema_migrations enable row level security")

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort()

  const { rows } = await client.query("select version from public.schema_migrations")
  const applied = new Set(rows.map((row) => row.version))

  let pending = 0
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file}`)
      continue
    }

    pending += 1
    if (statusOnly) {
      console.log(`pend  ${file}`)
      continue
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8")
    console.log(`apply ${file}`)

    await client.query("begin")
    try {
      await client.query(sql)
      await client.query(
        "insert into public.schema_migrations (version) values ($1)",
        [file],
      )
      await client.query("commit")
    } catch (error) {
      await client.query("rollback")
      throw error
    }
  }

  if (statusOnly) {
    console.log(`${pending} pending migration(s)`)
  } else {
    console.log(pending === 0 ? "database is up to date" : `applied ${pending} migration(s)`)
  }
}

main()
  .catch((error) => {
    console.error(`migration failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => client.end())
