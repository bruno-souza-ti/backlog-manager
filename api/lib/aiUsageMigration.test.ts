import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((fileName) => fileName.endsWith("_ai_usage_guardrails.sql"));

function migrationSql(): string {
  expect(migrationFiles).toHaveLength(1);
  return readFileSync(resolve(migrationsDirectory, migrationFiles[0]), "utf8")
    .replace(/\r\n/g, "\n")
    .toLowerCase();
}

describe("AI usage guardrails migration contract", () => {
  it("keeps quota and audit data server-only behind forced RLS", () => {
    const sql = migrationSql();

    for (const table of ["ai_usage_buckets", "ai_request_log"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    }

    expect(sql).toContain("grant select, insert, update, delete on table public.ai_usage_buckets to service_role");
    expect(sql).toContain("grant select, insert on table public.ai_request_log to service_role");
    expect(sql).not.toMatch(/grant\s+[^;]+\s+to\s+(?:anon|authenticated)\b/);
  });

  it("restricts the privileged quota RPC to the backend role", () => {
    const sql = migrationSql();

    expect(sql).toContain("security definer\nset search_path = ''");
    expect(sql).toContain("revoke all on function public.reserve_ai_quota(uuid, text, integer, integer, integer) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.reserve_ai_quota(uuid, text, integer, integer, integer) to service_role");
  });

  it("serializes concurrent reservations and stores metadata only", () => {
    const sql = migrationSql();
    const auditTable = sql.slice(
      sql.indexOf("create table if not exists public.ai_request_log"),
      sql.indexOf("create index if not exists ai_request_log_user_created_idx"),
    );

    expect(sql).toContain("for update");
    expect(auditTable).toContain("request_id text not null unique");
    expect(auditTable).toContain("input_chars integer not null");
    expect(auditTable).toContain("duration_ms integer not null");
    expect(auditTable).toContain("status_code integer not null");
    expect(auditTable).not.toMatch(/\b(prompt|response|document|transcript|content)\b/);
  });
});
