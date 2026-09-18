import { getGarminTrainingSnapshot, listGarminWorkouts } from "./garmin-adapter.js";
import { getTrainingPeaksReadiness, listTrainingPeaksWorkouts } from "./trainingpeaks-adapter.js";
import { mergeLikelyDuplicates } from "./training-model.js";
import { getStravaConnectionStatus, listStravaWorkouts } from "./strava-adapter.js";

export async function listCombinedWorkouts(days = 28, includeStrava = false) {
  const providers = await Promise.all([listTrainingPeaksWorkouts(days), listGarminWorkouts(days)]);
  if (includeStrava && getStravaConnectionStatus().connected) providers.push(await listStravaWorkouts());
  return {
    periodDays: days,
    providers: providers.map((provider) => provider.source),
    strava: getStravaConnectionStatus(),
    workouts: mergeLikelyDuplicates(providers.flatMap((provider) => provider.workouts))
  };
}

const firstNumber = (value) => {
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return firstNumber(value[0]?.value ?? value[0]);
  if (value && typeof value === "object") return firstNumber(value.value);
  return null;
};

export async function getCombinedReadiness() {
  const [trainingPeaks, garmin] = await Promise.all([getTrainingPeaksReadiness(), getGarminTrainingSnapshot()]);
  const metrics = garmin.recovery.restingHeartRate?.allMetrics?.metricsMap ?? {};
  const restingHeartRate = firstNumber(metrics.WELLNESS_RESTING_HEART_RATE);
  const signals = [];
  if (restingHeartRate != null) signals.push({ name: "resting_heart_rate", value: restingHeartRate, source: "Garmin Connect" });
  if (garmin.recovery.hrv?.available !== false) signals.push({ name: "hrv", value: garmin.recovery.hrv, source: "Garmin Connect" });
  return {
    status: trainingPeaks.status,
    recommendation: trainingPeaks.recommendation,
    trainingForm: trainingPeaks.trainingForm,
    recoverySignals: signals,
    unavailableSignals: ["sleep", "stress", "body_battery", "hrv", "resting_heart_rate"].filter((name) => !signals.some((signal) => signal.name === name)),
    note: "TrainingPeaks form currently drives the status. Garmin recovery values are included when available and are never estimated."
  };
}
