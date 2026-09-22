import { activityLoad } from "./training-engine.js";
import { periodIntensityDistribution } from "./zones.js";
import { resolveProbableActivityDuplicates } from "./activity-fingerprint.js";

const dayMs = 86_400_000;
const round = (value) => Math.round(value * 10) / 10;
const day = (value) => new Date(value).toISOString().slice(0, 10);
const week = (value) => {
  const date = new Date(`${day(value)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};
const startOf = (date) => new Date(`${date}T00:00:00.000Z`).getTime();
const endOf = (date) => startOf(date) + dayMs;

function summary(activities, ftpWatts) {
  const durationSeconds = activities.reduce((total, activity) => total + (activity.durationSeconds ?? 0), 0);
  const distanceMeters = activities.reduce((total, activity) => total + (activity.distanceMeters ?? 0), 0);
  const elevationGainMeters = activities.reduce((total, activity) => total + (activity.elevationGainMeters ?? 0), 0);
  const loads = activities.map((activity) => ({ activity, ...activityLoad(activity, ftpWatts) }));
  const availableLoads = loads.filter((entry) => entry.value != null);
  const bySport = Object.fromEntries(Object.entries(Object.groupBy(activities, (activity) => activity.sport)).map(([sport, items]) => [sport, {
    activityCount: items.length,
    durationSeconds: items.reduce((total, activity) => total + (activity.durationSeconds ?? 0), 0),
    distanceMeters: items.reduce((total, activity) => total + (activity.distanceMeters ?? 0), 0)
  }]));
  return {
    activityCount: activities.length,
    durationSeconds,
    distanceMeters,
    elevationGainMeters: elevationGainMeters || null,
    bySport,
    load: availableLoads.length ? { total: round(availableLoads.reduce((total, entry) => total + entry.value, 0)), averagePerActivity: round(availableLoads.reduce((total, entry) => total + entry.value, 0) / availableLoads.length), availableActivityCount: availableLoads.length } : { total: null, averagePerActivity: null, availableActivityCount: 0 }
  };
}

function weeklySummary(activities, ftpWatts) {
  return Object.entries(Object.groupBy(activities, (activity) => week(activity.startedAt))).map(([weekOf, items]) => ({
    weekOf,
    ...summary(items, ftpWatts)
  })).sort((left, right) => left.weekOf.localeCompare(right.weekOf));
}

function changes(current, previous) {
  const percent = (value, prior) => prior ? round(value / prior * 100) : null;
  return {
    activityCount: current.activityCount - previous.activityCount,
    durationSeconds: current.durationSeconds - previous.durationSeconds,
    durationPercent: percent(current.durationSeconds - previous.durationSeconds, previous.durationSeconds),
    distanceMeters: current.distanceMeters - previous.distanceMeters,
    distancePercent: percent(current.distanceMeters - previous.distanceMeters, previous.distanceMeters),
    load: current.load.total != null && previous.load.total != null ? { change: round(current.load.total - previous.load.total), percent: percent(current.load.total - previous.load.total, previous.load.total) } : { change: null, percent: null }
  };
}

export function analyseTrainingBlock(allActivities, { from, to, sport = undefined, profile = {} } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(to ?? "")) throw new Error("Use ISO calendar dates for from and to, for example 2026-09-01.");
  const fromTime = startOf(from), toTime = endOf(to);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || toTime <= fromTime) throw new Error("The training-block end date must be on or after its start date.");
  const select = (minimum, maximum) => allActivities.filter((activity) => {
    const time = new Date(activity.startedAt).getTime();
    return time >= minimum && time < maximum && (!sport || activity.sport === sport);
  });
  const currentRecords = select(fromTime, toTime);
  const durationDays = Math.round((toTime - fromTime) / dayMs);
  const previousRecords = select(fromTime - durationDays * dayMs, fromTime);
  const currentResolution = resolveProbableActivityDuplicates(currentRecords);
  const previousResolution = resolveProbableActivityDuplicates(previousRecords);
  const activities = currentResolution.activities;
  const previous = previousResolution.activities;
  const currentSummary = summary(activities, profile.ftpWatts);
  const previousSummary = summary(previous, profile.ftpWatts);
  const intensity = periodIntensityDistribution(activities, profile);
  const rankedByDuration = [...activities].sort((left, right) => (right.durationSeconds ?? 0) - (left.durationSeconds ?? 0));
  const rankedByLoad = activities.map((activity) => ({ activity, ...activityLoad(activity, profile.ftpWatts) })).filter((entry) => entry.value != null).sort((left, right) => right.value - left.value);
  return {
    period: { from, to, days: durationDays, sport: sport ?? null },
    importedRecordCount: currentResolution.importedRecordCount,
    uniqueActivityCount: activities.length,
    excludedProbableDuplicates: currentResolution.excludedProbableDuplicates,
    ...currentSummary,
    weekly: weeklySummary(activities, profile.ftpWatts),
    intensity,
    comparisonWithPreviousPeriod: { period: { from: day(fromTime - durationDays * dayMs), to: day(fromTime - dayMs) }, importedRecordCount: previousResolution.importedRecordCount, uniqueActivityCount: previous.length, excludedProbableDuplicates: previousResolution.excludedProbableDuplicates, summary: previousSummary, change: changes(currentSummary, previousSummary) },
    highlights: {
      longestActivity: rankedByDuration[0] ? { activityId: rankedByDuration[0].id, startedAt: rankedByDuration[0].startedAt, sport: rankedByDuration[0].sport, durationSeconds: rankedByDuration[0].durationSeconds, distanceMeters: rankedByDuration[0].distanceMeters } : null,
      highestLoadActivity: rankedByLoad[0] ? { activityId: rankedByLoad[0].activity.id, startedAt: rankedByLoad[0].activity.startedAt, sport: rankedByLoad[0].activity.sport, load: round(rankedByLoad[0].value), loadSource: rankedByLoad[0].source } : null
    },
    notes: [
      currentSummary.load.total == null ? "Training load is unavailable for this block. Import file-provided training stress or set FTP in the athlete profile." : null,
      activities.length && intensity.power.status !== "available" ? "Power intensity distribution is unavailable because the selected activities lack usable timestamped power samples or FTP." : null,
      activities.length && intensity.heartRate.status !== "available" ? "Heart-rate intensity distribution is unavailable because the selected activities lack usable timestamped HR samples or a configured HR threshold." : null
    ].filter(Boolean)
  };
}
