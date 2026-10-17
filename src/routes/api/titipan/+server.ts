import { api } from "../../../convex/_generated/api";
import { bodyOf, json, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { convexServer } from "../../../lib/titip/convex.server";
import { isArah, isStatus } from "../../../lib/titip/titipan";

export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const result = await convexServer().query(api.titipan.list, {});
  if ("error" in result && result.error) {
    return json({ error: result.error }, result.error === "masuk" ? 401 : 403);
  }
  return json({ rows: (result as { rows: unknown[] }).rows });
}

export async function POST({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const body = await bodyOf(request);
  const nama = typeof body.nama === "string" ? body.nama.trim() : "";
  const catatan = typeof body.catatan === "string" ? body.catatan.trim() : "";
  const kg = typeof body.kg === "number" ? body.kg : Number(body.kg);
  if (!isArah(body.arah) || nama.length < 1 || nama.length > 80) return json({ error: "isian" }, 400);
  if (!Number.isFinite(kg) || kg <= 0 || kg > 40) return json({ error: "kg" }, 400);
  if (catatan.length > 240) return json({ error: "isian" }, 400);
  const result = await convexServer().mutation(api.titipan.create, { arah: body.arah, nama, kg, catatan });
  if ("error" in result && result.error) {
    return json({ error: result.error }, result.error === "masuk" ? 401 : 403);
  }
  return json({ id: (result as { id: string }).id }, 201);
}

export async function PATCH({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const body = await bodyOf(request);
  const id = typeof body.id === "string" ? body.id : "";
  const assigning = Object.hasOwn(body, "jastiperId");
  if (!id || (assigning
    ? Object.hasOwn(body, "status") || !(body.jastiperId === null || (typeof body.jastiperId === "string" && body.jastiperId.length > 0))
    : !isStatus(body.status))) return json({ error: "isian" }, 400);
  let result: Record<string, unknown>;
  try {
    result = assigning
      ? await convexServer().mutation(api.titipan.assign, { id: id as never, jastiperId: body.jastiperId as string | null })
      : await convexServer().mutation(api.titipan.setStatus, { id: id as never, status: body.status as "baru" | "dibawa" | "selesai" });
  } catch {
    return json({ error: "isian" }, 400);
  }
  if ("error" in result && result.error) {
    const status = result.error === "masuk" ? 401 : result.error === "tidak-ada" ? 404 : 403;
    return json({ error: result.error }, status);
  }
  return json(assigning ? { id, jastiperId: body.jastiperId } : { id, status: body.status });
}
