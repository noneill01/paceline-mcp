import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const trainingPeaksRoot = new URL("../work/trainingpeaks-mcp/", import.meta.url);
const pythonPath = fileURLToPath(new URL(".venv/bin/python", trainingPeaksRoot));
const commandPath = fileURLToPath(new URL(".venv/bin/tp-mcp", trainingPeaksRoot));

const date = (offsetDays = 0) => {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
};

const readResult = (result) => {
  const text = result.content.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("TrainingPeaks returned no readable content.");
  return JSON.parse(text);
};

async function withTrainingPeaks(callback) {
  const transport = new StdioClientTransport({
    command: pythonPath,
    args: [commandPath, "serve"],
    stderr: "pipe"
  });
  const client = new Client({ name: "training-coach-combined-mcp", version: "0.1.0" });
  try {
    await client.connect(transport);
    const get = async (name, args = {}) => readResult(await client.callTool({ name, arguments: args }));
    return await callback(get);
  } finally {
    await transport.close();
  }
}

const round = (value) => Math.round(value * 10) / 10;

export async function getTrainingPeaksSnapshot() {
  return withTrainingPeaks(async (get) => {
    const [profile, currentWeek, completed, nextEvent] = await Promise.all([
      get("tp_get_profile"),
      get("tp_get_weekly_summary", { week_of: date() }),
      get("tp_get_workouts", { start_date: date(-28), end_date: date(), type: "completed" }),
      get("tp_get_next_event")
    ]);
    return {
      source: "TrainingPeaks",
      profile: { name: profile.name, accountType: profile.account_type },
      currentWeek,
      recentCompleted: completed.workouts,
      nextEvent: nextEvent.event
    };
  });
}

export async function getTrainingPeaksLoad() {
  return withTrainingPeaks(async (get) => {
    const [fitness, completed] = await Promise.all([
      get("tp_get_fitness", { days: 90 }),
      get("tp_get_workouts", { start_date: date(-28), end_date: date(), type: "completed" })
    ]);
    const workouts = completed.workouts ?? [];
    const totalTss = workouts.reduce((total, workout) => total + (workout.tss_actual ?? workout.tss ?? 0), 0);
    const durationHours = workouts.reduce((total, workout) => total + (workout.duration_actual ?? 0), 0);
    const firstCtl = fitness.daily_data?.[0]?.ctl;
    return {
      source: "TrainingPeaks",
      period: `${date(-28)} to ${date()}`,
      fitness: fitness.current,
      recentTraining: { completedSessions: workouts.length, totalTss: round(totalTss), durationHours: round(durationHours) },
      fitnessChangeOver90Days: firstCtl == null ? null : round(fitness.current.ctl - firstCtl),
      interpretation: fitness.current.tsb > 15
        ? "Form is strongly positive: recovery is high relative to recent load. Rebuild progressively if no event is imminent."
        : fitness.current.tsb < -10
          ? "Fatigue is elevated relative to fitness. Keep the next training block conservative."
          : "Fitness and recent fatigue appear broadly balanced."
    };
  });
}

export async function getTrainingPeaksReadiness() {
  const load = await getTrainingPeaksLoad();
  const tsb = load.fitness.tsb;
  return {
    source: "TrainingPeaks",
    status: tsb > 15 ? "fresh" : tsb < -10 ? "fatigued" : "balanced",
    trainingForm: tsb,
    recommendation: load.interpretation,
    limitation: "This is a training-load signal, not a recovery assessment. Connect Garmin to add sleep, HRV, resting heart rate, and readiness signals."
  };
}

export async function getTrainingPeaksRisks() {
  return withTrainingPeaks(async (get) => {
    const [load, completed] = await Promise.all([
      getTrainingPeaksLoad(),
      get("tp_get_workouts", { start_date: date(-28), end_date: date(), type: "completed" })
    ]);
    const shortened = (completed.workouts ?? []).filter((workout) =>
      workout.duration_planned && workout.duration_actual && workout.duration_actual < workout.duration_planned * 0.8
    );
    const risks = [];
    if (load.fitness.tsb > 15) risks.push({ severity: "low", risk: "Detraining or premature return to high load", action: "Increase weekly load gradually; do not try to recreate the prior peak in one week." });
    if (shortened.length >= 2) risks.push({ severity: "medium", risk: "Repeated shortened planned sessions", evidence: `${shortened.length} recent sessions were under 80% of planned duration`, action: "Tailor session duration or frequency to the schedule you can consistently complete." });
    return risks;
  });
}

export async function draftTrainingPeaksPlan(availableDays = 4) {
  const [load, snapshot] = await Promise.all([getTrainingPeaksLoad(), getTrainingPeaksSnapshot()]);
  const targetTss = load.recentTraining.totalTss / 4;
  const longRideTss = Math.round(targetTss * 0.35);
  const enduranceTss = Math.round((targetTss - longRideTss) / Math.max(1, availableDays - 1));
  return {
    status: "draft_only",
    source: "TrainingPeaks",
    rationale: `${load.interpretation} The draft is based on your recent completed load, not the calendar's planned load.`,
    targetWeeklyTss: Math.round(targetTss),
    sessions: [
      { day: "Day 1", focus: "Endurance", targetTss: enduranceTss },
      { day: "Day 3", focus: "Upper endurance / tempo", targetTss: enduranceTss },
      { day: "Day 5", focus: "Endurance", targetTss: enduranceTss },
      { day: "Weekend", focus: "Long aerobic ride", targetTss: longRideTss }
    ].slice(0, availableDays),
    nextEvent: snapshot.nextEvent ?? "No event recorded; set a target event before progressing to a race-specific plan.",
    safetyNote: "Draft only. This server has no publish or calendar-write tool. Stop for worsening pain, illness, dizziness, or chest symptoms."
  };
}
