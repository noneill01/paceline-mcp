const minute = (value) => Math.round(value / 60) * 60;
const hundredMeters = (value) => Math.round(value / 100) * 100;

export function likelySameActivity(left, right) {
  if (left.sport !== right.sport) return false;
  const startDifference = Math.abs(new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime()) / 1000;
  if (!Number.isFinite(startDifference) || startDifference > 120) return false;
  const durationDifference = Math.abs((left.durationSeconds ?? 0) - (right.durationSeconds ?? 0));
  const durationTolerance = Math.max(60, Math.min(left.durationSeconds ?? 0, right.durationSeconds ?? 0) * 0.05);
  if (durationDifference > durationTolerance) return false;
  if (left.distanceMeters != null && right.distanceMeters != null) {
    const distanceDifference = Math.abs(left.distanceMeters - right.distanceMeters);
    if (distanceDifference > Math.max(100, Math.min(left.distanceMeters, right.distanceMeters) * 0.05)) return false;
  }
  return true;
}

export function activityFingerprint(activity) {
  return [
    activity.sport,
    new Date(Math.round(new Date(activity.startedAt).getTime() / 5000) * 5000).toISOString(),
    minute(activity.durationSeconds ?? 0),
    hundredMeters(activity.distanceMeters ?? 0),
    activity.source?.providerActivityId ?? ""
  ].join(":");
}
