from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.config import CODEX_BRIDGE_ENTRYPOINT, CODEX_WORKSPACE_DIR


@dataclass(slots=True)
class CodexSendResult:
    success: bool
    error_message: str | None = None
    response_text: str | None = None


class CodexBridgeError(RuntimeError):
    pass


class CodexService:
    """
    Placeholder Codex integration.
    Replace with a real Codex SDK bridge when the integration contract is fixed.
    """

    def __init__(self) -> None:
        self.bridge_entrypoint = CODEX_BRIDGE_ENTRYPOINT
        self.workspace_directory = Path(
            os.getenv("CODEX_WORKSPACE_DIR", str(CODEX_WORKSPACE_DIR))
        ).resolve()

    def create_session(self) -> str:
        payload = self._run_bridge("create-thread", {"workingDirectory": str(self.workspace_directory)})
        thread_id = payload.get("threadId")
        if not isinstance(thread_id, str) or not thread_id.strip():
            raise CodexBridgeError("Codex bridge did not return a valid threadId.")
        return thread_id

    def send_prompt(self, session_id: str, prompt: str) -> CodexSendResult:
        if not session_id or not prompt.strip():
            return CodexSendResult(success=False, error_message="Missing session or prompt.")

        try:
            payload = self._run_bridge(
                "run-prompt",
                {
                    "threadId": session_id,
                    "prompt": prompt,
                    "workingDirectory": str(self.workspace_directory),
                },
            )
        except CodexBridgeError as error:
            return CodexSendResult(success=False, error_message=str(error))

        return CodexSendResult(
            success=True,
            response_text=payload.get("responseText") if isinstance(payload.get("responseText"), str) else None,
        )

    def _run_bridge(self, command: str, payload: dict[str, object]) -> dict[str, object]:
        if not self.bridge_entrypoint.exists():
            raise CodexBridgeError(
                f"Codex bridge entrypoint not found: {self.bridge_entrypoint}"
            )

        process = subprocess.run(
            ["node", str(self.bridge_entrypoint), command],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            cwd=str(self.workspace_directory),
            env=os.environ.copy(),
            check=False,
        )

        if process.returncode != 0:
            message = process.stderr.strip() or process.stdout.strip() or "Codex bridge failed."
            raise CodexBridgeError(message)

        try:
            decoded = json.loads(process.stdout)
        except json.JSONDecodeError as error:
            raise CodexBridgeError("Codex bridge returned invalid JSON.") from error

        if not isinstance(decoded, dict):
            raise CodexBridgeError("Codex bridge returned an unexpected payload.")

        return decoded
