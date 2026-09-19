const day = (date) => new Date(date).toISOString().slice(0, 10);
const round = (value) => Math.round(value * 10) / 10;
const ftp = () => {
  const value = Number(process.env.PACELINE_FTP_WATTS);
  return Number.isFinite(value) && value > 0 ? value : null;
};

export function activityLoad(activity, ftpWatts = ftp()) {
  if (activity.metrics?.trainingStress != null) return { value: activity.metrics.trainingStress, source: "file_provided" };
  const normalizedPower = activity.power?.normalized;
  if (!ftpWatts || !normalizedPower || !activity.durationSeconds) return { value: null, source: "unavailable" };
  const intensityFactor = normalizedPower / ftpWatts;
  return { value: activity.durationSeconds / 3600 * intensityFactor ** 2 * 100, source: "power_derived", intensityFactor };
}

const week = (date) => {
  const value = new Date(`${day(date)}T00:00:00Z`);
  const offset = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - offset);
  return value.toISOString().slice(0, 10);
};

export function analyseTraining(activities, { days = 42, ftpWatts = ftp() } = {}) {
  const cutoff = Date.now() - days * 86_400_000;
  const included = activities.filter((activity) => new Date(activity.startedAt).getTime() >= cutoff);
  const daily = new Map();
  for (const activity of included) {
    const key = day(activity.startedAt);
    const current = daily.get(key) ?? { date: key, durationSeconds: 0, distanceMeters: 0, load: 0, loadAvailable: false };
    const load = activityLoad(activity, ftpWatts);
    current.durationSeconds += activity.durationSeconds ?? 0;
    current.distanceMeters += activity.distanceMeters ?? 0;
    if (load.value != null) { current.load += load.value; current.loadAvailable = true; }
    daily.set(key, current);
  }
  const series = [...daily.values()].sort((left, right) => left.date.localeCompare(right.date));
  let ctl = 0, atl = 0;
  const loadByDate = new Map(series.map((entry) => [entry.date, entry.load]));
  for (let cursor = new Date(Date.now() - Math.max(days, 90) * 86_400_000); cursor <= new Date(); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const load = loadByDate.get(cursor.toISOString().slice(0, 10)) ?? 0;
    ctl += (load - ctl) / 42;
    atl += (load - atl) / 7;
  }
  const weekly = Object.values(Object.groupBy(included, (activity) => week(activity.startedAt))).map((items) => ({
    weekOf: week(items[0].startedAt), activityCount: items.length,
    durationSeconds: items.reduce((total, activity) => total + (activity.durationSeconds ?? 0), 0),
    distanceMeters: items.reduce((total, activity) => total + (activity.distanceMeters ?? 0), 0),
    trainingStress: round(items.reduce((total, activity) => total + (activityLoad(activity, ftpWatts).value ?? 0), 0))
  })).sort((left, right) => left.weekOf.localeCompare(right.weekOf));
  return {
    periodDays: days, activityCount: included.length, totalDurationSeconds: included.reduce((total, activity) => total + (activity.durationSeconds ?? 0), 0), totalDistanceMeters: included.reduce((total, activity) => total + (activity.distanceMeters ?? 0), 0),
    weekly, daily: series, load: ftpWatts || included.some((activity) => activity.metrics?.trainingStress != null) ? { ctl: round(ctl), atl: round(atl), tsb: round(ctl - atl), ftpWatts, note: ftpWatts ? "Uses file-provided load where available, otherwise power-derived load from configured FTP." : "Uses only file-provided training stress; configure PACELINE_FTP_WATTS for power-derived load." } : { ctl: null, atl: null, tsb: null, ftpWatts: null, note: "Load is unavailable. Configure PACELINE_FTP_WATTS or import files containing training stress." }
  };
}

export function compareTrainingPeriods(activities, { days = 42, ftpWatts = ftp() } = {}) {
  const now = Date.now();
  const split = now - days * 86_400_000;
  const recent = analyseTraining(activities.filter((activity) => new Date(activity.startedAt).getTime() >= split), { days, ftpWatts });
  const previous = analyseTraining(activities.filter((activity) => { const time = new Date(activity.startedAt).getTime(); return time >= split - days * 86_400_000 && time < split; }), { days: days * 2, ftpWatts });
  return { recent, previous, change: { durationSeconds: recent.totalDurationSeconds - previous.totalDurationSeconds, distanceMeters: recent.totalDistanceMeters - previous.totalDistanceMeters, activityCount: recent.activityCount - previous.activityCount } };
}
