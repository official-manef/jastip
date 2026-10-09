import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/meja")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
