import { databaseReady } from "../../../lib/titip/runtime-ready";

export function GET() {
  return Response.json({ accountsReady: databaseReady(process.env) }, { headers: { "cache-control": "no-store" } });
}
