import { getGarminTrainingSnapshot, getGarminWorkoutDetail, listGarminWorkouts } from "./garmin-adapter.js";
import { getTrainingPeaksReadiness, getTrainingPeaksWorkoutDetail, listTrainingPeaksWorkouts } from "./trainingpeaks-adapter.js";
import { mergeLikelyDuplicates } from "./training-model.js";
import { getStravaConnectionStatus, getStravaWorkoutDetail, listStravaWorkouts } from "./strava-adapter.js";

async function loadProviderWorkouts(days, includeStrava) {
  const providers = await Promise.all([listTrainingPeaksWorkouts(days), listGarminWorkouts(days)]);
  if (includeStrava && getStravaConnectionStatus().connected) providers.push(await listStravaWorkouts());
  return providers;
}

export async function listCombinedWorkouts(days = 28, includeStrava = false) {
  const providers = await loadProviderWorkouts(days, includeStrava);
  return {
    periodDays: days,
    providers: providers.map((provider) => provider.source),
    strava: getStravaConnectionStatus(),
    workouts: mergeLikelyDuplicates(providers.flatMap((provider) => provider.workouts))
  };
}

const requestedIdMatches = (workout, requestedId) => {
  const requested = String(requestedId);
  if (workout.id === requested) return true;
  return Object.entries(workout.providerIds ?? {}).some(([provider, id]) =>
    String(id) === requested || `${provider}:${id}` === requested ||
      (provider === "trainingPeaks" && `trainingpeaks:${id}` === requested)
  );
};

const plannedVsActual = (workout) => {
  if (!workout.planned || !workout.actual) return null;
  const difference = (actual, planned) => actual == null || planned == null ? null : actual - planned;
  return {
    durationSeconds: difference(workout.actual.durationSeconds, workout.planned.durationSeconds),
    distanceMeters: difference(workout.actual.distanceMeters, workout.planned.distanceMeters),
    trainingStress: difference(workout.actual.trainingStress, workout.planned.trainingStress)
  };
};

export async function getCombinedWorkoutDetail(workoutId, days = 90, includeStrava = true) {
  const providers = await loadProviderWorkouts(days, includeStrava);
  const workouts = mergeLikelyDuplicates(providers.flatMap((provider) => provider.workouts));
  const workout = workouts.find((candidate) => requestedIdMatches(candidate, workoutId));
  if (!workout) throw new Error("Workout was not found in the selected period. Use list_combined_workouts to select a workout ID.");

  const detailRequests = [];
  if (workout.providerIds.trainingPeaks) detailRequests.push(getTrainingPeaksWorkoutDetail(workout.providerIds.trainingPeaks, days));
  if (workout.providerIds.garmin) detailRequests.push(getGarminWorkoutDetail(workout.providerIds.garmin));
  if (workout.providerIds.strava) detailRequests.push(getStravaWorkoutDetail(workout.providerIds.strava));
  const settledDetails = await Promise.allSettled(detailRequests);
  const providerDetails = settledDetails.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const unavailableProviderDetails = settledDetails.flatMap((result) => result.status === "rejected" ? [result.reason?.message ?? "Provider detail could not be loaded."] : []);
  const routeDetail = providerDetails.find((detail) => detail.workout.route?.points)?.workout.route
    ?? providerDetails.find((detail) => detail.workout.route)?.workout.route
    ?? workout.route;

  return {
    id: workout.id,
    workout: { ...workout, route: routeDetail },
    plannedVsActual: plannedVsActual(workout),
    providerDetails,
    unavailableProviderDetails,
    note: "Provider details include all fields supplied for this workout. Garmin recorded route points are preferred when available; no values are estimated."
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
