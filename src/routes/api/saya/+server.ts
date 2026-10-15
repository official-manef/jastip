import { api } from "../../../convex/_generated/api";
import { json, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { convexServer } from "../../../lib/titip/convex.server";

export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const data = await convexServer().query(api.accounts.me, {});
  return json({ ...data, databaseReady: true });
}
