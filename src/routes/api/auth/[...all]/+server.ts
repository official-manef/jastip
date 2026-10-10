import { auth } from "../../../../lib/auth/server";

const handle = ({ request }: { request: Request }) => auth.handler(request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
