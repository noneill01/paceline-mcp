import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { normalizeGarminActivity } from "./training-model.js";

const bundledGarminRoot = fileURLToPath(new URL("../work/garmin-mcp/", import.meta.url));
const garminRoot = resolve(process.env.PACELINE_GARMIN_MCP_PATH || bundledGarminRoot);
const commandPath = resolve(garminRoot, ".venv/bin/garmin-mcp");
const pythonPath = resolve(garminRoot, ".venv/bin/python");
const routeScript = fileURLToPath(new URL("../scripts/garmin-route.py", import.meta.url));
const execFileAsync = promisify(execFile);

const isoDate = (offsetDays = 0) => {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
};

const parse = (result) => {
  const text = result.content.find((item) => item.type === "text")?.text ?? "";
  try { return JSON.parse(text); } catch { return { available: false, message: text }; }
};

async function withGarmin(callback) {
  const transport = new StdioClientTransport({ command: commandPath, args: [], stderr: "pipe" });
  const client = new Client({ name: "training-coach-combined-mcp", version: "0.3.0" });
  try {
    await client.connect(transport);
    const get = async (name, args = {}) => parse(await client.callTool({ name, arguments: args }));
    return await callback(get);
  } finally {
    await transport.close();
  }
}

export async function getGarminTrainingSnapshot() {
  return withGarmin(async (get) => {
    const today = isoDate();
    const [activityPage, heartRate, hrv, restingHeartRate, sleep, stress] = await Promise.all([
      get("get_activities_by_date", { start_date: isoDate(-7), end_date: today }),
      get("get_heart_rates_summary", { date: today }),
      get("get_hrv_data", { date: today }),
      get("get_rhr_day", { date: today }),
      get("get_sleep_summary", { date: today }),
      get("get_stress_summary", { date: today })
    ]);
    return {
      source: "Garmin Connect",
      date: today,
      activities: activityPage.activities ?? [],
      recovery: { heartRate, hrv, restingHeartRate, sleep, stress },
      note: "Only signals present in Garmin Connect are returned. Empty values are kept empty rather than estimated."
    };
  });
}

async function getRoute(activityId) {
  const { stdout } = await execFileAsync(pythonPath, [routeScript, String(activityId)], { maxBuffer: 2_000_000 });
  const start = stdout.indexOf("{");
  if (start < 0) return null;
  const payload = JSON.parse(stdout.slice(start));
  return payload.points.length ? { points: payload.points } : null;
}

export async function getGarminWorkoutDetail(activityId) {
  return withGarmin(async (get) => {
    const [activity, route] = await Promise.all([get("get_activity", { activity_id: activityId }), getRoute(activityId)]);
    const workout = normalizeGarminActivity({ ...activity, route });
    return { source: "Garmin Connect", workout, providerData: { ...activity, route }, note: route ? "Route points were recorded by Garmin." : "No GPS route was recorded for this activity." };
  });
}

export async function listGarminWorkouts(days = 28) {
  return withGarmin(async (get) => {
    const page = await get("get_activities_by_date", { start_date: isoDate(-days), end_date: isoDate() });
    return { source: "Garmin Connect", workouts: (page.activities ?? []).map(normalizeGarminActivity) };
  });
}
