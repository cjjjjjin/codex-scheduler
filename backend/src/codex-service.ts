import { Codex } from "@openai/codex-sdk";

import { DEFAULT_WORKSPACE_DIRECTORY } from "./config.js";
import { CodexServiceError } from "./errors.js";
import type { CodexSendResult } from "./types.js";

const THREAD_BOOTSTRAP_PROMPT =
  "Initialize this thread for future scheduled task conversations. Reply with exactly: READY";

function resolveWorkspaceDirectory(workspaceDirectory?: string): string {
  return workspaceDirectory ?? DEFAULT_WORKSPACE_DIRECTORY;
}

export class CodexService {
  async createThread(workspaceDirectory?: string): Promise<string> {
    const codex = new Codex();
    const thread = codex.startThread({
      workingDirectory: resolveWorkspaceDirectory(workspaceDirectory)
    });

    try {
      await thread.run(THREAD_BOOTSTRAP_PROMPT);
    } catch (error) {
      throw new CodexServiceError(
        `Failed to initialize Codex thread: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!thread?.id || typeof thread.id !== "string") {
      throw new CodexServiceError("Codex SDK did not return a valid thread ID.");
    }

    return thread.id;
  }

  async sendPrompt(threadId: string, prompt: string, workspaceDirectory?: string): Promise<CodexSendResult> {
    if (!threadId || !prompt.trim()) {
      return {
        success: false,
        errorMessage: "Missing thread or prompt.",
        responseText: null
      };
    }

    try {
      const codex = new Codex();
      const thread = codex.resumeThread(threadId, {
        workingDirectory: resolveWorkspaceDirectory(workspaceDirectory)
      });
      const result = await thread.run(prompt);

      return {
        success: true,
        errorMessage: null,
        responseText: typeof result?.finalResponse === "string" ? result.finalResponse : null
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseText: null
      };
    }
  }
}
