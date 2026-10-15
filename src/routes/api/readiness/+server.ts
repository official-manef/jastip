import { databaseReady } from "../../../lib/titip/runtime";

/** Apakah penyimpanan akun aktif. Sejak auth pindah ke Convex, selalu siap. */
export function GET() {
  return Response.json(
    { accountsReady: databaseReady(process.env) },
    { headers: { "cache-control": "no-store" } },
  );
}
