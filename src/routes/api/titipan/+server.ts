import { getSql } from "../../../lib/db";
import { bodyOf, json, listTitipan, readAccount, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { isArah, isStatus } from "../../../lib/titip/titipan";

function canCarry(role: string | null): boolean {
  return role === "jastiper" || role === "admin";
}

function canAsk(role: string | null): boolean {
  return role === "klien" || role === "admin";
}

export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  if (!account.role) return json({ error: "peran" }, 403);
  const sql = await getSql();
  const rows = await listTitipan(sql, account);
  return json({ rows });
}

export async function POST({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  if (!canAsk(account.role)) return json({ error: "bukan-klien" }, 403);
  const body = await bodyOf(request);
  const nama = typeof body.nama === "string" ? body.nama.trim() : "";
  const catatan = typeof body.catatan === "string" ? body.catatan.trim() : "";
  const kg = typeof body.kg === "number" ? body.kg : Number(body.kg);
  if (!isArah(body.arah) || nama.length < 1 || nama.length > 80) return json({ error: "isian" }, 400);
  if (!Number.isFinite(kg) || kg <= 0 || kg > 40) return json({ error: "kg" }, 400);
  if (catatan.length > 240) return json({ error: "isian" }, 400);
  const sql = await getSql();
  const id = crypto.randomUUID();
  await sql`
    insert into titipan (id, user_id, arah, nama, kg, catatan)
    values (${id}, ${account.user.id}, ${body.arah}, ${nama}, ${kg}, ${catatan})
  `;
  return json({ id }, 201);
}

export async function PATCH({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ error: "masuk" }, 401);
  if (!canCarry(account.role)) return json({ error: "bukan-jastiper" }, 403);
  const body = await bodyOf(request);
  const id = typeof body.id === "string" ? body.id : "";
  if (!id || !isStatus(body.status)) return json({ error: "isian" }, 400);
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    update titipan set status = ${body.status} where id = ${id} returning id
  `;
  if (!rows.length) return json({ error: "tidak-ada" }, 404);
  return json({ id, status: body.status });
}
