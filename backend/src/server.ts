import { PORT } from "./config.js";
import { createApp } from "./app.js";
import { createRuntime } from "./runtime.js";

const runtime = createRuntime();
const app = createApp(runtime);

const server = app.listen(PORT, async () => {
  await app.startRuntime();
  console.log(`codex-schedule backend listening on http://localhost:${PORT}`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await app.stopRuntime();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
