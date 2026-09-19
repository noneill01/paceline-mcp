import { openLocalActivityStore } from "./local-activity-store.js";
import { analyseTraining, compareTrainingPeriods } from "./training-engine.js";

export function getLocalActivities(limit = 50) {
  const store = openLocalActivityStore();
  try { return { source: "PaceLine Local", activities: store.listActivities({ limit }) }; }
  finally { store.close(); }
}

export function getLocalActivity(activityId) {
  const store = openLocalActivityStore();
  try {
    const activity = store.getActivity(activityId);
    if (!activity) throw new Error("Local activity was not found.");
    return { source: "PaceLine Local", activity };
  } finally { store.close(); }
}

export function getLocalTrainingSummary(days = 42) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const activities = getLocalActivities(500).activities.filter((activity) => new Date(activity.startedAt).getTime() >= cutoff);
  const durationSeconds = activities.reduce((total, activity) => total + (activity.durationSeconds ?? 0), 0);
  const distanceMeters = activities.reduce((total, activity) => total + (activity.distanceMeters ?? 0), 0);
  const trainingStress = activities.reduce((total, activity) => total + (activity.metrics.trainingStress ?? 0), 0);
  const bySport = Object.fromEntries(Object.entries(Object.groupBy(activities, (activity) => activity.sport)).map(([sport, items]) => [sport, {
    activityCount: items.length,
    durationSeconds: items.reduce((total, activity) => total + (activity.durationSeconds ?? 0), 0),
    distanceMeters: items.reduce((total, activity) => total + (activity.distanceMeters ?? 0), 0)
  }]));
  return {
    source: "PaceLine Local",
    periodDays: days,
    activityCount: activities.length,
    durationSeconds,
    distanceMeters,
    trainingStress: trainingStress || null,
    bySport
  };
}

export function getLocalTrainingLoad(days = 42) {
  const activities = getLocalActivities(500).activities;
  return { source: "PaceLine Local", ...analyseTraining(activities, { days }) };
}

export function compareLocalTrainingPeriods(days = 42) {
  const activities = getLocalActivities(500).activities;
  return { source: "PaceLine Local", ...compareTrainingPeriods(activities, { days }) };
}
