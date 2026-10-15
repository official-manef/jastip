import { createSvelteKitHandler } from "@mmailaender/convex-better-auth-svelte/sveltekit";
import { convexSiteUrl } from "../../../../lib/convex-url";

/** Proxy semua request auth SvelteKit ke Convex HTTP actions (`*.convex.site`). */
export const { GET, POST } = createSvelteKitHandler({ convexSiteUrl: convexSiteUrl() });
