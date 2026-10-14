import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Exit code that mirrors the child's status (or 1 when a signal killed it). */
function exitStatusFromChild(code, signal) {
  if (typeof code === "number") return code;
  return signal ? 1 : 0;
}

const root = fileURLToPath(new URL("..", import.meta.url));
const viteBin = join(root, "node_modules/vite/bin/vite.js");
const bunCandidates = ["/usr/local/bin/bun", join(process.env.HOME ?? "", ".bun/bin/bun")];
const bun = bunCandidates.find((path) => existsSync(path));
const args = process.argv.slice(2);
const command = bun ?? process.execPath;
const commandArgs = bun ? ["--bun", viteBin, ...args] : [viteBin, ...args];
const child = spawn(command, commandArgs, { stdio: "inherit", env: process.env });

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (err) => {
  console.error(`[run-vite] failed to run ${command}:`, err?.message || err);
  process.exit(127);
});
child.on("exit", (code, signal) => {
  process.exit(exitStatusFromChild(code, signal));
});
