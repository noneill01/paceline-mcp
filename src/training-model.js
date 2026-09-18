const asNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
const hoursToSeconds = (value) => asNumber(value) == null ? null : Math.round(value * 3600);

export function normalizeTrainingPeaksWorkout(workout) {
  const completed = workout.type === "completed";
  return {
    id: `trainingpeaks:${workout.id}`,
    providerIds: { trainingPeaks: String(workout.id) },
    sourceProviders: ["TrainingPeaks"],
    date: workout.date,
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

const sportFamily = (sport) => String(sport ?? "").toLowerCase().replace(/[_\s-]/g, "").replace("treadmillrunning", "running").replace("cycling", "bike");

export function likelySameWorkout(left, right) {
  if (left.status !== "completed" || right.status !== "completed" || left.date !== right.date) return false;
  if (sportFamily(left.sport) !== sportFamily(right.sport)) return false;
  const leftDuration = left.actual?.durationSeconds;
  const rightDuration = right.actual?.durationSeconds;
  if (!leftDuration || !rightDuration) return false;
  return Math.abs(leftDuration - rightDuration) <= Math.max(900, Math.min(leftDuration, rightDuration) * 0.2);
}

export function mergeLikelyDuplicates(workouts) {
  const merged = [];
  for (const workout of workouts) {
    const match = merged.find((candidate) => likelySameWorkout(candidate, workout));
    if (!match) { merged.push(workout); continue; }
    match.sourceProviders.push(...workout.sourceProviders);
    match.providerIds = { ...match.providerIds, ...workout.providerIds };
    match.route ??= workout.route;
    match.physiology = { ...workout.physiology, ...match.physiology };
    match.actual = { ...workout.actual, ...match.actual };
    match.planned ??= workout.planned;
  }
  return merged.sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`));
}
