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
  `PACELINE_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`,
  `PACELINE_EXPERIMENTAL_DB_PATH=${resolve(configDirectory, "data", "experimental.sqlite")}`,
  `PACELINE_ACTIVITY_DB_PATH=${resolve(configDirectory, "data", "activities.sqlite")}`,
  "# Optional: enables power-derived IF, TSS/load, CTL, ATL, TSB, and power zones.",
  "PACELINE_FTP_WATTS=",
  "",
  "# Optional experimental local connector paths. Do not put account cookies here.",
  "PACELINE_TRAININGPEAKS_MCP_PATH=",
  "PACELINE_GARMIN_MCP_PATH=",
  ""
].join("\n");

const printHelp = () => console.log(`PaceLine Local MCP

Usage:
  paceline init                Create private local configuration and encryption key
  paceline doctor              Check local setup without exposing credentials
  paceline import <path>       Import one FIT/TCX file or a folder of activities
  paceline serve               Start the MCP server over stdio

Set PACELINE_HOME to use a different configuration directory. Default: ${configDirectory}`);

const start = (script) => {
  if (!existsSync(configPath)) {
    console.error(`PaceLine is not configured. Run: paceline init`);
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

const loadConfiguration = () => {
  if (!existsSync(configPath)) throw new Error("PaceLine is not configured. Run: paceline init");
  if (typeof process.loadEnvFile === "function") process.loadEnvFile(configPath);
};

if (command === "init") {
  mkdirSync(configDirectory, { recursive: true, mode: 0o700 });
  mkdirSync(resolve(configDirectory, "data"), { recursive: true, mode: 0o700 });
  if (existsSync(configPath)) {
    console.log(`Configuration already exists at ${configPath}. Nothing was changed.`);
  } else {
    writeFileSync(configPath, template(), { mode: 0o600 });
    console.log(`Created private PaceLine configuration at ${configPath}.\n\nNext:\n  paceline doctor\n  paceline serve`);
  }
} else if (command === "doctor") {
  const configured = existsSync(configPath);
  const file = configured ? await import("node:fs/promises").then(({ readFile }) => readFile(configPath, "utf8")) : "";
  const set = (name) => new RegExp(`^${name}=.+$`, "m").test(file);
  const pathValue = (name) => file.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim();
  console.log(`PaceLine configuration: ${configured ? "found" : "missing"}`);
  console.log(`Local encryption key: ${set("PACELINE_ENCRYPTION_KEY") ? "configured" : set("TRAINING_COACH_ENCRYPTION_KEY") ? "configured (legacy name)" : "missing"}`);
  for (const [name, label] of [["PACELINE_TRAININGPEAKS_MCP_PATH", "TrainingPeaks experimental connector"], ["PACELINE_GARMIN_MCP_PATH", "Garmin experimental connector"]]) {
    const value = pathValue(name);
    console.log(`${label}: ${value && existsSync(value) ? "available" : "not configured"}`);
  }
  console.log("No credentials or activity data were read by this check.");
  if (!configured) process.exitCode = 1;
} else if (command === "import") {
  try {
    const target = process.argv[3];
    if (!target) throw new Error("Provide a FIT/TCX file or folder: paceline import <path>");
    loadConfiguration();
    const { importActivityPath } = await import("../src/fit-importer.js");
    const result = await importActivityPath(target);
    const bySport = Object.groupBy(result.activities, (activity) => activity.sport);
    const dates = result.activities.map((activity) => activity.startedAt.slice(0, 10)).sort();
    console.log(`Scanned ${result.scannedFiles} supported files.\n\nImported ${result.activityCount} activities from ${result.importedFiles} files. ${result.duplicateFiles} exact duplicates were skipped. ${result.probableDuplicates.length} probable activity duplicates were flagged.`);
    for (const [sport, activities] of Object.entries(bySport)) console.log(`${sport}: ${activities.length}`);
    if (dates.length) console.log(`Date range: ${dates[0]} → ${dates.at(-1)}`);
    if (result.failures.length) console.error(`${result.failures.length} files could not be imported. Run again with individual files to inspect them.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (command === "serve") {
  start(resolve(packageRoot, "src", "trainingpeaks-server.js"));
} else {
  printHelp();
  if (command !== "help" && command !== "--help" && command !== "-h") process.exitCode = 1;
}
