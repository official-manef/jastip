import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Titipin — Jakarta ↔ Turki" }] }),
  component: Home,
});

function Home() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let destroy: (() => void) | undefined;
    let cancel = false;
    void (async () => {
      const [{ default: Desk }, { mount, unmount }] = await Promise.all([
        import("@/desk/Desk.svelte"),
        import("svelte"),
      ]);
      if (cancel || !host.current) return;
      const app = mount(Desk, { target: host.current });
      destroy = () => {
        void unmount(app);
      };
    })();
    return () => {
      cancel = true;
      destroy?.();
    };
  }, []);

  return <div ref={host} />;
}
