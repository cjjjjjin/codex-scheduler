import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKEND_ROOT = path.resolve(__dirname, "..");
export const PROJECT_ROOT = path.resolve(BACKEND_ROOT, "..");
export const DATA_DIR = path.join(BACKEND_ROOT, "data");
export const DB_PATH = path.join(DATA_DIR, "app.db");
export const PORT = Number.parseInt(process.env.PORT ?? "8000", 10);
export const SCHEDULER_POLL_MS = Number.parseInt(process.env.SCHEDULER_POLL_MS ?? "15000", 10);
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Seoul";
export const CODEX_APP_SERVER_URL = process.env.CODEX_APP_SERVER_URL ?? "ws://127.0.0.1:4500";
export const DEFAULT_WORKSPACE_DIRECTORY = path.resolve(
  process.env.CODEX_WORKSPACE_DIR ?? PROJECT_ROOT
);
