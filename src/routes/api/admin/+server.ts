import { api } from "../../../convex/_generated/api";
import { bodyOf, json, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { convexServer } from "../../../lib/titip/convex.server";
import { isRole } from "../../../lib/titip/roles";

export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const result = await convexServer().query(api.accounts.listPeople, {});
  if ("error" in result && result.error) {
    return json({ error: result.error }, result.error === "masuk" ? 401 : 403);
  }
  return json({ people: (result as { people: unknown[] }).people });
}

export async function POST({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const body = await bodyOf(request);
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId || !isRole(body.role)) return json({ error: "isian" }, 400);
  const result = await convexServer().mutation(api.accounts.setRole, { userId, role: body.role });
  if ("error" in result && result.error) {
    const status = result.error === "masuk" ? 401 : result.error === "bukan-admin" ? 403 : result.error === "tidak-ada" ? 404 : 409;
    return json({ error: result.error }, status);
  }
  return json({ ok: true });
}
