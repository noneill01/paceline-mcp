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

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const sourceRank = { fit_file: 2, tcx_file: 1 };

// Score fields that are useful to analysis rather than assuming one file format
// is always better. The source rank only provides a deterministic final nudge.
export function activityRichness(activity) {
  const summaryFields = [
    activity.distanceMeters, activity.elevationGainMeters,
    activity.heartRate?.average, activity.heartRate?.maximum,
    activity.power?.average, activity.power?.maximum, activity.power?.normalized,
    activity.cadence?.average, activity.metrics?.trainingStress, activity.metrics?.intensityFactor
  ].filter(finite).length;
  const sampleFields = ["position_lat", "position_long", "altitude", "distance", "speed", "heart_rate", "cadence", "power", "temperature", "grade"].filter((field) => activity.samples?.some((sample) => finite(sample?.[field]))).length;
  const sampleCount = Math.min(activity.samples?.length ?? 0, 100);
  return summaryFields * 100 + sampleFields * 10 + sampleCount / 10 + (sourceRank[activity.source?.type] ?? 0);
}

const recordReference = (activity) => ({
  activityId: activity.id,
  sourceType: activity.source?.type ?? "unknown",
  fileName: activity.source?.fileName ?? null,
  startedAt: activity.startedAt,
  richnessScore: activityRichness(activity)
});

const preferRicher = (left, right) => {
  const scoreDifference = activityRichness(right) - activityRichness(left);
  return scoreDifference || String(left.id).localeCompare(String(right.id));
};

// Resolve clusters rather than only pairs, so results do not depend on import order.
export function resolveProbableActivityDuplicates(activities) {
  const records = [...activities].sort((left, right) => new Date(left.startedAt) - new Date(right.startedAt) || String(left.id).localeCompare(String(right.id)));
  const parents = records.map((_, index) => index);
  const find = (index) => parents[index] === index ? index : (parents[index] = find(parents[index]));
  const join = (left, right) => { const leftRoot = find(left), rightRoot = find(right); if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot; };
  for (let left = 0; left < records.length; left += 1) for (let right = left + 1; right < records.length; right += 1) if (likelySameActivity(records[left], records[right])) join(left, right);
  const clusters = new Map();
  for (let index = 0; index < records.length; index += 1) {
    const root = find(index);
    clusters.set(root, [...(clusters.get(root) ?? []), records[index]]);
  }
  const retained = [];
  const excludedProbableDuplicates = [];
  for (const cluster of clusters.values()) {
    const canonical = [...cluster].sort(preferRicher)[0];
    retained.push(canonical);
    for (const record of cluster) if (record !== canonical) excludedProbableDuplicates.push({
      excludedRecord: recordReference(record),
      retainedCanonicalRecord: recordReference(canonical),
      reason: "Same sport, near-identical start time, duration, and distance."
    });
  }
  return {
    activities: retained.sort((left, right) => new Date(left.startedAt) - new Date(right.startedAt) || String(left.id).localeCompare(String(right.id))),
    importedRecordCount: records.length,
    excludedProbableDuplicates: excludedProbableDuplicates.sort((left, right) => left.excludedRecord.activityId.localeCompare(right.excludedRecord.activityId))
  };
}
