import { auth } from "../auth/server";
import { getSql, type Sql } from "../db";
import { isRole, type Role } from "./roles";
import { isArah, isStatus, type TitipanRow } from "./titipan";

export type AccountUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export type Account = {
  user: AccountUser;
  role: Role | null;
};

export async function readAccount(request: Request): Promise<Account | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  const sql = await getSql();
  const role = await roleFor(sql, session.user.id);
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    role,
  };
}

export async function roleFor(sql: Sql, userId: string): Promise<Role | null> {
  const rows = await sql<{ role: string }>`select role from profiles where user_id = ${userId}`;
  const role = rows[0]?.role;
  return isRole(role) ? role : null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Block scripted cross-site calls. Same-origin, non-browser, and top-level GET stay. */
export function rejectedCrossSite(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  if (!site || site === "same-origin" || site === "none") return null;
  const dest = request.headers.get("sec-fetch-dest");
  const topLevelGet =
    request.headers.get("sec-fetch-mode") === "navigate" &&
    request.method === "GET" &&
    dest !== "object" &&
    dest !== "embed";
  if (topLevelGet) return null;
  return json({ error: "lintas-situs" }, 403);
}

export async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    /* not json */
  }
  return {};
}

export async function claimRole(
  sql: Sql,
  userId: string,
  role: Role,
): Promise<{ ok: true; role: Role; locked: boolean } | { ok: false; error: "admin-taken" }> {
  const current = await roleFor(sql, userId);
  if (current) return { ok: true, role: current, locked: true };
  if (role === "admin") {
    const admins = await sql<{ user_id: string }>`select user_id from profiles where role = 'admin' limit 1`;
    if (admins.length > 0) return { ok: false, error: "admin-taken" };
  }
  try {
    await sql`insert into profiles (user_id, role) values (${userId}, ${role})`;
  } catch (err) {
    const again = await roleFor(sql, userId);
    if (again) return { ok: true, role: again, locked: true };
    const message = err instanceof Error ? err.message : "";
    if (/unique|duplicate/i.test(message)) return { ok: false, error: "admin-taken" };
    throw err;
  }
  return { ok: true, role, locked: false };
}

export async function setRole(
  sql: Sql,
  userId: string,
  role: Role,
): Promise<{ ok: true } | { ok: false; error: "admin-taken" | "admin-terakhir" | "tidak-ada" }> {
  const users = await sql<{ id: string }>`select id from "user" where id = ${userId}`;
  if (!users.length) return { ok: false, error: "tidak-ada" };
  const admins = await sql<{ user_id: string }>`select user_id from profiles where role = 'admin'`;
  const isAdmin = admins.some((row) => row.user_id === userId);
  if (role === "admin" && admins.length > 0 && !isAdmin) return { ok: false, error: "admin-taken" };
  if (role !== "admin" && isAdmin && admins.length === 1) return { ok: false, error: "admin-terakhir" };
  await sql`
    insert into profiles (user_id, role) values (${userId}, ${role})
    on conflict (user_id) do update set role = excluded.role
  `;
  return { ok: true };
}

export type Person = {
  id: string;
  name: string;
  email: string;
  role: Role | null;
};

export async function listPeople(sql: Sql): Promise<Person[]> {
  const rows = await sql<{ id: string; name: string; email: string; role: string | null }>`
    select u.id, u.name, u.email, p.role
    from "user" u
    left join profiles p on p.user_id = u.id
    order by u."createdAt" asc
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: isRole(row.role) ? row.role : null,
  }));
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : "";
}

export async function listTitipan(sql: Sql, account: Account): Promise<TitipanRow[]> {
  const rows =
    account.role === "klien"
      ? await sql<Record<string, unknown>>`
          select t.id, t.user_id, u.name as pemilik, t.arah, t.nama, t.kg, t.catatan, t.status, t.created_at
          from titipan t
          join "user" u on u.id = t.user_id
          where t.user_id = ${account.user.id}
          order by t.created_at desc
          limit 100
        `
      : await sql<Record<string, unknown>>`
          select t.id, t.user_id, u.name as pemilik, t.arah, t.nama, t.kg, t.catatan, t.status, t.created_at
          from titipan t
          join "user" u on u.id = t.user_id
          order by t.created_at desc
          limit 100
        `;
  return rows.flatMap((row) => {
    if (!isArah(row.arah) || !isStatus(row.status)) return [];
    const kg = asNumber(row.kg);
    return [
      {
        id: String(row.id),
        userId: String(row.user_id),
        pemilik: String(row.pemilik ?? ""),
        arah: row.arah,
        nama: String(row.nama ?? ""),
        kg: Number.isFinite(kg) ? kg : 0,
        catatan: String(row.catatan ?? ""),
        status: row.status,
        createdAt: asIso(row.created_at),
      },
    ];
  });
}
