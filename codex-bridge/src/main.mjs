import { stdin, stdout, stderr, exit } from "node:process";
import { Codex } from "@openai/codex-sdk";

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      data += chunk;
    });
    stdin.on("end", () => resolve(data));
    stdin.on("error", reject);
  });
}

function fail(message, details) {
  const payload = details ? `${message}\n${details}` : message;
  stderr.write(payload);
  exit(1);
}

function buildThreadOptions(input) {
  const options = {};

  if (typeof input.workingDirectory === "string" && input.workingDirectory.trim()) {
    options.workingDirectory = input.workingDirectory.trim();
  }

  if (typeof input.model === "string" && input.model.trim()) {
    options.model = input.model.trim();
  }

  if (
    input.sandboxMode === "read-only" ||
    input.sandboxMode === "workspace-write" ||
    input.sandboxMode === "danger-full-access"
  ) {
    options.sandboxMode = input.sandboxMode;
  }

  if (typeof input.skipGitRepoCheck === "boolean") {
    options.skipGitRepoCheck = input.skipGitRepoCheck;
  }

  return options;
}

async function createThread(payload) {
  const codex = new Codex();
  const thread = codex.startThread(buildThreadOptions(payload));

  if (!thread.id || typeof thread.id !== "string") {
    fail(
      "Codex SDK did not return a thread ID during thread creation.",
      "Verify the installed SDK version and whether thread IDs are available before the first run."
    );
  }

  stdout.write(JSON.stringify({ threadId: thread.id }));
}

async function runPrompt(payload) {
  if (typeof payload.threadId !== "string" || !payload.threadId.trim()) {
    fail("Missing threadId.");
  }

  if (typeof payload.prompt !== "string" || !payload.prompt.trim()) {
    fail("Missing prompt.");
  }

  const codex = new Codex();
  const thread = codex.resumeThread(payload.threadId.trim(), buildThreadOptions(payload));
  const result = await thread.run(payload.prompt);

  stdout.write(
    JSON.stringify({
      threadId: thread.id ?? payload.threadId.trim(),
      responseText: typeof result?.finalResponse === "string" ? result.finalResponse : null
    })
  );
}

async function main() {
  const command = process.argv[2];
  const rawInput = await readStdin();
  const payload = rawInput.trim() ? JSON.parse(rawInput) : {};

  if (command === "create-thread") {
    await createThread(payload);
    return;
  }

  if (command === "run-prompt") {
    await runPrompt(payload);
    return;
  }

  fail(`Unsupported command: ${command ?? "(missing)"}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fail("Codex bridge execution failed.", message);
});
