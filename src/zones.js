import { trainingZones } from "./athlete-profile.js";

const round = (value) => Math.round(value * 10) / 10;
const channel = { power: "power", heartRate: "heart_rate" };
const intervalCapSeconds = 30;

const zoneFor = (value, zones, lowerKey, upperKey) => zones.find((zone) => value >= zone[lowerKey] && (zone[upperKey] == null || value < zone[upperKey]));

function sampledZoneTime(samples, metric, zones, lowerKey, upperKey) {
  const series = samples
    .filter((sample) => Number.isFinite(sample?.[metric]) && Number.isFinite(new Date(sample.timestamp).getTime()))
    .map((sample) => ({ value: sample[metric], timestamp: new Date(sample.timestamp).getTime() }))
    .sort((left, right) => left.timestamp - right.timestamp);
  if (series.length < 2) return { status: "unavailable", reason: "At least two timestamped samples are required.", zones: [] };
  const seconds = new Map(zones.map((zone) => [zone.id, 0]));
  for (let index = 0; index < series.length - 1; index += 1) {
    const duration = Math.min(intervalCapSeconds, Math.max(0, (series[index + 1].timestamp - series[index].timestamp) / 1000));
    const zone = zoneFor(series[index].value, zones, lowerKey, upperKey);
    if (zone) seconds.set(zone.id, seconds.get(zone.id) + duration);
  }
  const totalSeconds = [...seconds.values()].reduce((sum, value) => sum + value, 0);
  if (!totalSeconds) return { status: "unavailable", reason: "Samples had no usable elapsed time.", zones: [] };
  return {
    status: "available",
    totalSeconds: round(totalSeconds),
    zones: zones.map((zone) => ({ id: zone.id, label: zone.label, seconds: round(seconds.get(zone.id)), percent: round(seconds.get(zone.id) / totalSeconds * 100) }))
  };
}

function intensityFromPower(distribution) {
  if (distribution.status !== "available") return { status: "unavailable", reason: distribution.reason };
  const pick = (ids) => distribution.zones.filter((zone) => ids.includes(zone.id)).reduce((total, zone) => total + zone.seconds, 0);
  const easy = pick(["Z1", "Z2"]), moderate = pick(["Z3", "Z4"]), hard = pick(["Z5", "Z6", "Z7"]);
  const totalSeconds = easy + moderate + hard;
  return { status: "available", totalSeconds, easy: { seconds: easy, percent: round(easy / totalSeconds * 100) }, moderate: { seconds: moderate, percent: round(moderate / totalSeconds * 100) }, hard: { seconds: hard, percent: round(hard / totalSeconds * 100) } };
}

export function activityIntensityDistribution(activity, profile = {}) {
  const zones = trainingZones(profile);
  const power = zones.power.status === "available" ? sampledZoneTime(activity.samples ?? [], channel.power, zones.power.zones, "minWatts", "maxWatts") : { status: "unavailable", reason: zones.power.reason, zones: [] };
  const heartRate = zones.heartRate.status === "available" ? sampledZoneTime(activity.samples ?? [], channel.heartRate, zones.heartRate.zones, "minBpm", "maxBpm") : { status: "unavailable", reason: zones.heartRate.reason, zones: [] };
  return { activityId: activity.id, sport: activity.sport, power, heartRate, intensity: intensityFromPower(power) };
}

export function periodIntensityDistribution(activities, profile = {}) {
  const all = activities.map((activity) => activityIntensityDistribution(activity, profile));
  const combine = (key) => {
    const available = all.map((entry) => entry[key]).filter((entry) => entry.status === "available");
    if (!available.length) return { status: "unavailable", reason: `No activities had usable ${key === "power" ? "power" : "heart-rate"} samples and configured zones.`, zones: [] };
    const totals = new Map();
    for (const distribution of available) for (const zone of distribution.zones) totals.set(zone.id, (totals.get(zone.id) ?? 0) + zone.seconds);
    const totalSeconds = [...totals.values()].reduce((sum, value) => sum + value, 0);
    const definitions = available[0].zones;
    return { status: "available", totalSeconds: round(totalSeconds), zones: definitions.map((zone) => ({ id: zone.id, label: zone.label, seconds: round(totals.get(zone.id) ?? 0), percent: round((totals.get(zone.id) ?? 0) / totalSeconds * 100) })) };
  };
  const power = combine("power");
  return { activityCount: activities.length, activitiesWithPowerSamples: all.filter((entry) => entry.power.status === "available").length, activitiesWithHeartRateSamples: all.filter((entry) => entry.heartRate.status === "available").length, power, heartRate: combine("heartRate"), intensity: intensityFromPower(power) };
}
