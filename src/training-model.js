const asNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
const hoursToSeconds = (value) => asNumber(value) == null ? null : Math.round(value * 3600);
const asDateTime = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
};
const asLocalDateTime = (value) => {
  if (!value) return null;
  // Strava marks start_date_local with Z even though its clock time is local.
  // Remove that transport marker before comparing it with Garmin local timestamps.
  return asDateTime(String(value).replace(/Z$/, ""));
};

export function normalizeTrainingPeaksWorkout(workout) {
  const completed = workout.type === "completed";
  return {
    id: `trainingpeaks:${workout.id}`,
    providerIds: { trainingPeaks: String(workout.id) },
    sourceProviders: ["TrainingPeaks"],
    date: workout.date,
    startTime: asDateTime(workout.start_time ?? workout.start_time_local ?? workout.completed_at),
    status: completed ? "completed" : "planned",
    sport: workout.sport ?? null,
    title: workout.title ?? "Untitled workout",
    planned: {
      durationSeconds: hoursToSeconds(workout.duration_planned),
      distanceMeters: asNumber(workout.distance_planned_km) == null ? null : workout.distance_planned_km * 1000,
      trainingStress: asNumber(workout.tss_planned ?? workout.tss)
    },
    actual: completed ? {
      durationSeconds: hoursToSeconds(workout.duration_actual),
      distanceMeters: asNumber(workout.distance_actual_km) == null ? null : workout.distance_actual_km * 1000,
      trainingStress: asNumber(workout.tss_actual ?? workout.tss)
    } : null,
    description: workout.description || null,
    route: null,
    physiology: null
  };
}

export function normalizeGarminActivity(activity) {
  return {
    id: `garmin:${activity.id}`,
    providerIds: { garmin: String(activity.id) },
    sourceProviders: ["Garmin Connect"],
    date: String(activity.start_time ?? activity.start_time_local ?? "").slice(0, 10),
    startTime: asDateTime(activity.start_time ?? activity.start_time_local),
    status: "completed",
    sport: activity.type ?? null,
    title: activity.name ?? "Untitled activity",
    planned: null,
    actual: {
      durationSeconds: asNumber(activity.duration_seconds),
      distanceMeters: asNumber(activity.distance_meters),
      trainingStress: asNumber(activity.training_load)
    },
    description: activity.description || null,
    route: activity.route ?? null,
    physiology: {
      averageHeartRate: asNumber(activity.avg_hr_bpm),
      maximumHeartRate: asNumber(activity.max_hr_bpm),
      minimumHeartRate: asNumber(activity.min_hr_bpm),
      averagePower: asNumber(activity.avg_power_watts),
      normalizedPower: asNumber(activity.normalized_power_watts),
      averageCadence: asNumber(activity.avg_cadence)
    }
  };
}

export function normalizeStravaActivity(activity) {
  return {
    id: `strava:${activity.id}`,
    providerIds: { strava: String(activity.id) },
    sourceProviders: ["Strava"],
    date: String(activity.start_date_local ?? activity.start_date ?? "").slice(0, 10),
    // Compare local session times across providers. Garmin commonly supplies a local
    // timestamp, while Strava provides both local and UTC variants.
    startTime: activity.start_date_local ? asLocalDateTime(activity.start_date_local) : asDateTime(activity.start_date),
    status: "completed",
    sport: activity.sport_type ?? activity.type ?? null,
    title: activity.name ?? "Untitled activity",
    planned: null,
    actual: { durationSeconds: asNumber(activity.moving_time ?? activity.elapsed_time), distanceMeters: asNumber(activity.distance), trainingStress: null },
    description: activity.description || null,
    route: activity.map?.summary_polyline ? { encodedPolyline: activity.map.summary_polyline } : null,
    physiology: { averageHeartRate: asNumber(activity.average_heartrate), maximumHeartRate: asNumber(activity.max_heartrate), averagePower: asNumber(activity.average_watts), normalizedPower: asNumber(activity.weighted_average_watts), averageCadence: asNumber(activity.average_cadence) }
  };
}

const sportFamily = (sport) => {
  const normalized = String(sport ?? "").toLowerCase().replace(/[_\s-]/g, "");
  if (["cycling", "ride", "virtualride", "gravelride", "mountainbike", "roadbike", "bike"].includes(normalized)) return "bike";
  if (["running", "treadmillrunning", "trailrun", "run", "virtualrun"].includes(normalized)) return "run";
  if (["swimming", "swim", "openswimming"].includes(normalized)) return "swim";
  if (["walking", "walk", "hiking", "hike"].includes(normalized)) return "walk";
  return normalized;
};

const timeDifferenceSeconds = (left, right) => {
  if (!left.startTime || !right.startTime) return null;
  const difference = Math.abs(new Date(left.startTime).getTime() - new Date(right.startTime).getTime()) / 1000;
  return Number.isFinite(difference) ? difference : null;
};

const distanceDifferenceRatio = (left, right) => {
  const leftDistance = left.actual?.distanceMeters;
  const rightDistance = right.actual?.distanceMeters;
  if (!leftDistance || !rightDistance) return null;
  return Math.abs(leftDistance - rightDistance) / Math.max(leftDistance, rightDistance);
};

export function workoutMatchEvidence(left, right) {
  if (left.sourceProviders.some((provider) => right.sourceProviders.includes(provider))) return { matches: false, reasons: ["same_provider"] };
  if (left.status !== "completed" || right.status !== "completed") return { matches: false, reasons: ["not_both_completed"] };
  if (left.date !== right.date) return { matches: false, reasons: ["different_date"] };
  if (sportFamily(left.sport) !== sportFamily(right.sport)) return { matches: false, reasons: ["different_sport"] };

  const leftDuration = left.actual?.durationSeconds;
  const rightDuration = right.actual?.durationSeconds;
  if (!leftDuration || !rightDuration) return { matches: false, reasons: ["missing_duration"] };
  const durationDifference = Math.abs(leftDuration - rightDuration);
  const durationTolerance = Math.max(300, Math.min(leftDuration, rightDuration) * 0.12);
  if (durationDifference > durationTolerance) return { matches: false, reasons: ["duration_outside_tolerance"] };

  const startDifference = timeDifferenceSeconds(left, right);
  if (startDifference != null && startDifference > 20 * 60) return { matches: false, reasons: ["start_time_outside_tolerance"] };
  const distanceDifference = distanceDifferenceRatio(left, right);
  if (distanceDifference != null && distanceDifference > 0.15) return { matches: false, reasons: ["distance_outside_tolerance"] };

  const reasons = ["same_date", "same_sport", "similar_duration"];
  if (startDifference != null) reasons.push("nearby_start_time");
  if (distanceDifference != null) reasons.push("similar_distance");
  return { matches: true, reasons, confidence: startDifference != null && distanceDifference != null ? "high" : "medium" };
}

export function likelySameWorkout(left, right) {
  return workoutMatchEvidence(left, right).matches;
}

export function mergeLikelyDuplicates(workouts) {
  const merged = [];
  for (const workout of workouts) {
    const match = merged.find((candidate) => likelySameWorkout(candidate, workout));
    if (!match) { merged.push(structuredClone(workout)); continue; }
    const evidence = workoutMatchEvidence(match, workout);
    match.sourceProviders.push(...workout.sourceProviders);
    match.sourceProviders = [...new Set(match.sourceProviders)].sort();
    match.providerIds = { ...match.providerIds, ...workout.providerIds };
    match.route ??= workout.route;
    match.startTime ??= workout.startTime;
    match.physiology = { ...workout.physiology, ...match.physiology };
    match.actual = { ...workout.actual, ...match.actual };
    match.planned ??= workout.planned;
    match.duplicateMatch = { confidence: evidence.confidence, reasons: evidence.reasons };
  }
  return merged.sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`));
}
