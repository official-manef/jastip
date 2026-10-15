import { initConvex } from "convex-svelte/sveltekit";
import { convexUrl } from "./lib/convex-url";

/** Inisialisasi klien Convex lebih awal (sebelum komponen mount). */
if (convexUrl) initConvex(convexUrl);
