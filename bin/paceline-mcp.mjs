#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configDirectory = resolve(process.env.PACELINE_HOME ?? `${homedir()}/.paceline`);
const configPath = resolve(configDirectory, ".env");
const command = process.argv[2] ?? "help";

const template = () => [
  "# PaceLine Local MCP configuration. This file stays on your computer.",
  `TRAINING_COACH_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`,
  `TRAINING_COACH_DB_PATH=${resolve(configDirectory, "data", "training-coach.sqlite")}`,
  "",
  "# Optional: connect your own registered Strava application.",
  "STRAVA_CLIENT_ID=",
  "STRAVA_CLIENT_SECRET=",
  "",
  "# Optional experimental local connector paths. Do not put account cookies here.",
  "PACELINE_TRAININGPEAKS_MCP_PATH=",
  "PACELINE_GARMIN_MCP_PATH=",
  ""
].join("\n");

const printHelp = () => console.log(`PaceLine Local MCP

Usage:
  paceline-mcp init                Create private local configuration and encryption key
  paceline-mcp doctor              Check local setup without exposing credentials
  paceline-mcp authorize-strava    Complete local Strava OAuth after configuring it
  paceline-mcp serve               Start the MCP server over stdio

Set PACELINE_HOME to use a different configuration directory. Default: ${configDirectory}`);

const start = (script) => {
  if (!existsSync(configPath)) {
    console.error(`PaceLine is not configured. Run: paceline-mcp init`);
    process.exitCode = 1;
    return;
  }
  const child = spawn(process.execPath, [`--env-file-if-exists=${configPath}`, script], {
    cwd: packageRoot,
    env: { ...process.env, PACELINE_HOME: configDirectory },
    stdio: "inherit"
  });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
};

if (command === "init") {
  mkdirSync(configDirectory, { recursive: true, mode: 0o700 });
  mkdirSync(resolve(configDirectory, "data"), { recursive: true, mode: 0o700 });
  if (existsSync(configPath)) {
    console.log(`Configuration already exists at ${configPath}. Nothing was changed.`);
  } else {
    writeFileSync(configPath, template(), { mode: 0o600 });
    console.log(`Created private PaceLine configuration at ${configPath}.\n\nNext: add your Strava client ID and secret, then run:\n  paceline-mcp authorize-strava\n  paceline-mcp serve`);
  }
} else if (command === "doctor") {
  const configured = existsSync(configPath);
  const file = configured ? await import("node:fs/promises").then(({ readFile }) => readFile(configPath, "utf8")) : "";
  const set = (name) => new RegExp(`^${name}=.+$`, "m").test(file);
  const pathValue = (name) => file.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim();
  console.log(`PaceLine configuration: ${configured ? "found" : "missing"}`);
  console.log(`Local encryption key: ${set("TRAINING_COACH_ENCRYPTION_KEY") ? "configured" : "missing"}`);
  console.log(`Strava application: ${set("STRAVA_CLIENT_ID") && set("STRAVA_CLIENT_SECRET") ? "configured" : "not configured"}`);
  for (const [name, label] of [["PACELINE_TRAININGPEAKS_MCP_PATH", "TrainingPeaks experimental connector"], ["PACELINE_GARMIN_MCP_PATH", "Garmin experimental connector"]]) {
    const value = pathValue(name);
    console.log(`${label}: ${value && existsSync(value) ? "available" : "not configured"}`);
  }
  console.log("No credentials or activity data were read by this check.");
  if (!configured) process.exitCode = 1;
} else if (command === "authorize-strava") {
  start(resolve(packageRoot, "scripts", "strava-authorize.mjs"));
} else if (command === "serve") {
  start(resolve(packageRoot, "src", "trainingpeaks-server.js"));
} else {
  printHelp();
  if (command !== "help" && command !== "--help" && command !== "-h") process.exitCode = 1;
}
