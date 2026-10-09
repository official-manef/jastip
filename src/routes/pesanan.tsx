import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/pesanan")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
