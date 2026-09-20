import { openLocalActivityStore } from "./local-activity-store.js";

const number = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const round = (value) => Math.round(value * 10) / 10;
const allowed = new Set(["ftpWatts", "maxHeartRate", "restingHeartRate", "lactateThresholdHeartRate", "weightKg", "preferredSports", "ctlTimeConstant", "atlTimeConstant"]);

const powerZoneBounds = [0, 55, 75, 90, 105, 120, 150];
const powerZones = (ftpWatts) => ftpWatts ? powerZoneBounds.map((minimumPercent, index) => ({
  id: `Z${index + 1}`,
  label: `Power Z${index + 1}`,
  minWatts: round(ftpWatts * minimumPercent / 100),
  maxWatts: index === powerZoneBounds.length - 1 ? null : round(ftpWatts * powerZoneBounds[index + 1] / 100),
  minPercentFtp: minimumPercent,
  maxPercentFtp: index === powerZoneBounds.length - 1 ? null : powerZoneBounds[index + 1]
})) : [];

const heartRatePercentBounds = (profile) => profile.lactateThresholdHeartRate ? [0, 81, 90, 94, 100] : [0, 60, 70, 80, 90];
const heartRateBasis = (profile) => profile.lactateThresholdHeartRate ? { value: profile.lactateThresholdHeartRate, label: "lactate-threshold heart rate", unit: "bpm" } : profile.maxHeartRate ? { value: profile.maxHeartRate, label: "maximum heart rate", unit: "bpm" } : null;
const heartRateZones = (profile) => {
  const basis = heartRateBasis(profile);
  if (!basis) return [];
  const bounds = heartRatePercentBounds(profile);
  return bounds.map((minimumPercent, index) => ({
    id: `Z${index + 1}`,
    label: `HR Z${index + 1}`,
    minBpm: round(basis.value * minimumPercent / 100),
    maxBpm: index === bounds.length - 1 ? null : round(basis.value * bounds[index + 1] / 100),
    minPercentBasis: minimumPercent,
    maxPercentBasis: index === bounds.length - 1 ? null : bounds[index + 1]
  }));
};

export function normaliseAthleteProfile(input = {}) {
  const profile = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) continue;
    if (key === "preferredSports") profile[key] = Array.isArray(value) ? [...new Set(value.map(String))] : [];
    else profile[key] = number(value);
  }
  return profile;
}

export function resolveAthleteProfile(storedProfile = {}, environment = process.env) {
  const profile = normaliseAthleteProfile(storedProfile);
  // The legacy environment setting remains a non-persistent fallback for existing users.
  profile.ftpWatts ??= number(environment.PACELINE_FTP_WATTS);
  profile.ctlTimeConstant ??= 42;
  profile.atlTimeConstant ??= 7;
  profile.preferredSports ??= [];
  return profile;
}

export function trainingZones(profile) {
  const resolved = resolveAthleteProfile(profile);
  const hrBasis = heartRateBasis(resolved);
  return {
    power: resolved.ftpWatts ? { status: "available", basis: { value: resolved.ftpWatts, label: "functional threshold power", unit: "watts" }, zones: powerZones(resolved.ftpWatts) } : { status: "unavailable", reason: "Set FTP to calculate power zones.", zones: [] },
    heartRate: hrBasis ? { status: "available", basis: hrBasis, zones: heartRateZones(resolved) } : { status: "unavailable", reason: "Set lactate-threshold or maximum heart rate to calculate heart-rate zones.", zones: [] }
  };
}

export function getAthleteProfile() {
  const store = openLocalActivityStore();
  try {
    const profile = resolveAthleteProfile(store.getAthleteProfile() ?? {});
    return { source: "PaceLine Local", profile, zones: trainingZones(profile) };
  } finally { store.close(); }
}

export function updateAthleteProfile(patch) {
  const store = openLocalActivityStore();
  try {
    const previous = store.getAthleteProfile() ?? {};
    const profile = resolveAthleteProfile({ ...previous, ...normaliseAthleteProfile(patch) });
    store.setAthleteProfile(profile);
    return { source: "PaceLine Local", profile, zones: trainingZones(profile) };
  } finally { store.close(); }
}
