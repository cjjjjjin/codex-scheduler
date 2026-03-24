from pathlib import Path
from zoneinfo import ZoneInfo


BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "app.db"
SCHEDULER_POLL_SECONDS = 15
APP_TIMEZONE = ZoneInfo("Asia/Seoul")
CODEX_BRIDGE_DIR = PROJECT_ROOT / "codex-bridge"
CODEX_BRIDGE_ENTRYPOINT = CODEX_BRIDGE_DIR / "src" / "main.mjs"
CODEX_WORKSPACE_DIR = PROJECT_ROOT
