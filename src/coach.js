import { athlete, workouts, recovery } from "./data.js";

const sum = (values) => values.reduce((total, value) => total + value, 0);

export function snapshot() {
  return { athlete, latestRecovery: recovery, recentWorkouts: workouts.slice(0, 5) };
}

export function loadSummary() {
  const currentWeek = workouts.slice(0, 4);
  const previousWeek = workouts.slice(4);
  const currentLoad = sum(currentWeek.map((workout) => workout.load));
  const previousLoad = sum(previousWeek.map((workout) => workout.load));
  const hardSessions = currentWeek.filter((workout) => workout.intensity === "hard").length;
  return {
    period: "Latest 7 days represented in fixture data",
    currentLoad,
    comparisonLoad: previousLoad,
    changePercent: Math.round(((currentLoad - previousLoad) / previousLoad) * 100),
    hardSessions,
    interpretation: currentLoad > previousLoad * 1.15
      ? "Load has increased materially; avoid adding another hard session until recovery improves."
      : "Load is progressing within the planned range."
  };
}

export function readiness() {
  const signals = [];
  if (recovery.sleepHours < recovery.sleepBaselineHours - 0.75) signals.push("sleep is below baseline");
  if (recovery.hrvMs < recovery.hrvBaselineMs * 0.9) signals.push("HRV is suppressed");
  if (recovery.restingHeartRate > recovery.restingHeartRateBaseline + 3) signals.push("resting heart rate is elevated");
  if (recovery.subjectiveFatigue >= 7) signals.push("reported fatigue is high");
  const status = signals.length >= 3 ? "red" : signals.length === 2 ? "amber" : "green";
  return {
    status,
    signals,
    recommendation: status === "red"
      ? "Take rest or 30–40 minutes very easy. Do not perform intervals today."
      : status === "amber"
        ? "Keep training easy today; reassess tomorrow before intensity."
        : "Recovery supports the planned session."
  };
}

export function risks() {
  const riskList = [];
  const today = readiness();
  const load = loadSummary();
  if (today.status !== "green") riskList.push({ severity: "medium", risk: "Accumulated fatigue", evidence: today.signals, action: "Replace the next quality session with easy running or rest." });
  if (load.changePercent > 15) riskList.push({ severity: "medium", risk: "Rapid load increase", evidence: [`Load is ${load.changePercent}% above comparison week`], action: "Hold total load steady next week." });
  if (recovery.soreness) riskList.push({ severity: "low", risk: "Local soreness", evidence: [recovery.soreness], action: "Stop a session if pain changes your gait; seek clinical advice for persistent or worsening pain." });
  return riskList;
}

export function draftPlan(days = athlete.constraints.availableDays) {
  const ready = readiness();
  const intensityDay = ready.status === "green" ? "Tuesday: 15 min easy, 3 × 8 min at threshold, 10 min easy" : "Tuesday: 40 min easy, conversational pace";
  return {
    status: "draft_only",
    rationale: ready.status === "green" ? "One quality session, two easy sessions, and a long run fit the athlete's constraints." : "Recovery signals are not ready for intensity, so the quality session has been reduced.",
    sessions: [
      "Monday: Rest and mobility",
      intensityDay,
      "Thursday: 45 min easy",
      "Saturday: 35 min easy + 4 relaxed strides",
      `${athlete.constraints.preferredLongRunDay}: 80 min easy long run`
    ].slice(0, Math.max(2, days + 1)),
    safetyNote: "This is training guidance, not medical advice. Do not train through worsening pain, illness, dizziness, or chest symptoms."
  };
}
