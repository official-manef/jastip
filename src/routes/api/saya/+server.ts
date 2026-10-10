import { json, readAccount, rejectedCrossSite } from "../../../lib/titip/accounts.server";

export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ user: null, role: null });
  return json({ user: account.user, role: account.role });
}
