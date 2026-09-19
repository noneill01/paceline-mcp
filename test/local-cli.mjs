import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const configHome = mkdtempSync(join(tmpdir(), "paceline-cli-"));
const options = { cwd: root, env: { ...process.env, PACELINE_HOME: configHome } };

const init = await execFileAsync(process.execPath, ["bin/paceline-mcp.mjs", "init"], options);
assert.match(init.stdout, /Created private PaceLine configuration/);
const config = readFileSync(join(configHome, ".env"), "utf8");
assert.match(config, /^TRAINING_COACH_ENCRYPTION_KEY=.+$/m);
assert.match(config, /^TRAINING_COACH_DB_PATH=.+$/m);
const doctor = await execFileAsync(process.execPath, ["bin/paceline-mcp.mjs", "doctor"], options);
assert.match(doctor.stdout, /PaceLine configuration: found/);
assert.match(doctor.stdout, /No credentials or activity data were read/);
console.log("Local MCP CLI test passed: private configuration and safe diagnostics work.");
