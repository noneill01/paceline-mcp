import assert from "node:assert/strict";
import { analyseTrainingBlock } from "../src/training-block.js";

const activity = ({ id, startedAt, durationSeconds, distanceMeters, power = 150, trainingStress = null }) => ({
  id, startedAt, sport: "ride", durationSeconds, distanceMeters, elevationGainMeters: 100,
  metrics: { trainingStress }, power: { normalized: power }, samples: [
    { timestamp: startedAt, power: 120, heart_rate: 120 },
    { timestamp: new Date(new Date(startedAt).getTime() + 30_000).toISOString(), power, heart_rate: 140 }
  ]
});
const activities = [
  activity({ id: "prior", startedAt: "2026-08-30T08:00:00Z", durationSeconds: 3_600, distanceMeters: 25_000, trainingStress: 50 }),
  activity({ id: "first", startedAt: "2026-09-02T08:00:00Z", durationSeconds: 7_200, distanceMeters: 50_000, power: 220, trainingStress: 100 }),
  activity({ id: "second", startedAt: "2026-09-12T08:00:00Z", durationSeconds: 3_600, distanceMeters: 30_000, power: 260, trainingStress: 60 })
];
const report = analyseTrainingBlock(activities, { from: "2026-09-01", to: "2026-09-30", profile: { ftpWatts: 250, lactateThresholdHeartRate: 160 } });
assert.equal(report.period.days, 30);
assert.equal(report.activityCount, 2);
assert.equal(report.durationSeconds, 10_800);
assert.equal(report.distanceMeters, 80_000);
assert.equal(report.load.total, 160);
assert.equal(report.weekly.length, 2);
assert.equal(report.intensity.power.status, "available");
assert.equal(report.comparisonWithPreviousPeriod.summary.activityCount, 1);
assert.equal(report.comparisonWithPreviousPeriod.change.durationSeconds, 7_200);
assert.equal(report.highlights.longestActivity.activityId, "first");
assert.equal(report.highlights.highestLoadActivity.activityId, "first");

const fitExport = {
  ...activity({ id: "fit:zwift:0", startedAt: "2026-09-20T10:32:50Z", durationSeconds: 3_372, distanceMeters: 30_493.28, power: 231 }),
  source: { type: "fit_file", fileName: "Zwift_2x20_upper_endurance.fit" },
  heartRate: { average: 127, maximum: 155 },
  power: { average: 231, maximum: 365, normalized: null },
  samples: [
    { timestamp: "2026-09-20T10:32:50Z", power: 200, heart_rate: 120, cadence: 85 },
    { timestamp: "2026-09-20T10:33:20Z", power: 240, heart_rate: 125, cadence: 88 }
  ]
};
const tcxExport = {
  ...activity({ id: "tcx:zwift:0", startedAt: "2026-09-20T10:32:50Z", durationSeconds: 3_372, distanceMeters: 30_493.28, power: 231 }),
  source: { type: "tcx_file", fileName: "activity_24430994251.tcx" },
  heartRate: { average: null, maximum: 155 },
  power: { average: null, maximum: null, normalized: null },
  samples: [
    { timestamp: "2026-09-20T10:32:50Z", heart_rate: 120 },
    { timestamp: "2026-09-20T10:33:20Z", heart_rate: 125 }
  ]
};
const deduplicated = analyseTrainingBlock([tcxExport, fitExport], { from: "2026-09-20", to: "2026-09-20", profile: { ftpWatts: 250, lactateThresholdHeartRate: 160 } });
assert.equal(deduplicated.importedRecordCount, 2);
assert.equal(deduplicated.uniqueActivityCount, 1);
assert.equal(deduplicated.activityCount, 1);
assert.equal(deduplicated.durationSeconds, 3_372);
assert.equal(deduplicated.excludedProbableDuplicates.length, 1);
assert.equal(deduplicated.excludedProbableDuplicates[0].excludedRecord.activityId, "tcx:zwift:0");
assert.equal(deduplicated.excludedProbableDuplicates[0].retainedCanonicalRecord.activityId, "fit:zwift:0");
assert.equal(deduplicated.intensity.activitiesWithPowerSamples, 1);
console.log("Training-block test passed: a bounded period receives deterministic volume, load, intensity, and comparison analysis.");
