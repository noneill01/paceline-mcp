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
assert.match(config, /^PACELINE_ENCRYPTION_KEY=.+$/m);
assert.match(config, /^PACELINE_EXPERIMENTAL_DB_PATH=.+$/m);
const doctor = await execFileAsync(process.execPath, ["bin/paceline-mcp.mjs", "doctor"], options);
assert.match(doctor.stdout, /PaceLine configuration: found/);
assert.match(doctor.stdout, /No credentials or activity data were read/);
const profileSet = await execFileAsync(process.execPath, ["bin/paceline-mcp.mjs", "profile", "set", "--ftp-watts", "250", "--lthr", "160"], options);
assert.match(profileSet.stdout, /"ftpWatts": 250/);
const profile = await execFileAsync(process.execPath, ["bin/paceline-mcp.mjs", "profile"], options);
assert.match(profile.stdout, /"lactateThresholdHeartRate": 160/);
assert.match(profile.stdout, /"Power Z1"/);
console.log("Local MCP CLI test passed: private configuration and safe diagnostics work.");
