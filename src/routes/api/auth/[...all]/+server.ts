import { auth } from "../../../../lib/auth/server";
import { databaseReady } from "../../../../lib/titip/runtime";

const handle = ({ request }: { request: Request }) => {
  if (!databaseReady(process.env)) return Response.json({ error: "database-unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  return auth.handler(request);
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
