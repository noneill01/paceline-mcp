import { openLocalActivityStore } from "./local-activity-store.js";
import { analyseTraining, compareTrainingPeriods } from "./training-engine.js";
import { getAthleteProfile, trainingZones } from "./athlete-profile.js";
import { periodIntensityDistribution } from "./zones.js";
import { analyseTrainingBlock } from "./training-block.js";

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

export function getLocalAthleteProfile() {
  return getAthleteProfile();
}

export function getLocalTrainingZones() {
  const profile = getAthleteProfile();
  return { source: "PaceLine Local", profile: profile.profile, zones: trainingZones(profile.profile) };
}

export function getLocalIntensityDistribution(days = 42, sport = undefined) {
  const cutoff = Date.now() - days * 86_400_000;
  const activities = getLocalActivities(500).activities.filter((activity) => new Date(activity.startedAt).getTime() >= cutoff && (!sport || activity.sport === sport));
  const profile = getAthleteProfile().profile;
  return { source: "PaceLine Local", periodDays: days, sport: sport ?? null, ...periodIntensityDistribution(activities, profile) };
}

export function getLocalTrainingBlock({ from, to, sport = undefined }) {
  const activities = getLocalActivities(5_000).activities;
  const profile = getAthleteProfile().profile;
  return { source: "PaceLine Local", ...analyseTrainingBlock(activities, { from, to, sport, profile }) };
}
