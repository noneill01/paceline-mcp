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
console.log("Training-block test passed: a bounded period receives deterministic volume, load, intensity, and comparison analysis.");
