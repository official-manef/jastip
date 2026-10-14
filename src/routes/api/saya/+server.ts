import { json, readAccount, rejectedCrossSite } from "../../../lib/titip/accounts.server";
import { canClaimAdmin } from "../../../lib/titip/runtime";

export async function GET({ request }: { request: Request }) {
  const blocked = rejectedCrossSite(request);
  if (blocked) return blocked;
  const account = await readAccount(request);
  if (!account) return json({ user: null, role: null, databaseReady: true, canClaimAdmin: false });
  return json({ user: account.user, role: account.role, databaseReady: true,
    canClaimAdmin: canClaimAdmin(account.user.id, process.env.TITIPIN_ADMIN_USER_ID) });
}
