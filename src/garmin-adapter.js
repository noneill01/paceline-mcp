import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const garminRoot = new URL("../work/garmin-mcp/", import.meta.url);
const commandPath = fileURLToPath(new URL(".venv/bin/garmin-mcp", garminRoot));

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
