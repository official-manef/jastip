import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

/** Rute auth dipasang di deployment Convex; SvelteKit mem-proxy ke sini. */
const http = httpRouter();
authComponent.registerRoutes(http, createAuth);

export default http;
