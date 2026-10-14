import { databaseReady } from "../../../lib/titip/runtime";

export function GET() {
  return Response.json({ accountsReady: databaseReady(process.env) }, { headers: { "cache-control": "no-store" } });
}
