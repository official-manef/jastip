import { databaseReady } from "../../../lib/titip/runtime";

/** Whether account storage (DATABASE_URL) is live — read by the sign-in UI. */
export function GET() {
  return Response.json(
    { accountsReady: databaseReady(process.env) },
    { headers: { "cache-control": "no-store" } },
  );
}
