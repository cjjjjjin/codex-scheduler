import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SkillService } from "./skill-service.js";

test("installs task-settings skill into workspace", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-schedule-skill-"));
  const svc = new SkillService();

  const skillPath = svc.ensureTaskSettingsSkillInstalled(root);
  const text = fs.readFileSync(skillPath, "utf8");

  assert.equal(skillPath, path.join(root, ".agents", "skills", "task-settings", "SKILL.md"));
  assert.match(text, /name: task-settings/);
  assert.match(text, /PATCH \/api\/agent\/tasks\/:taskId\/settings/);
});
