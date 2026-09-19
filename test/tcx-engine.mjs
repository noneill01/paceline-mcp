import assert from "node:assert/strict";
import { canonicalActivitiesFromTcx } from "../src/tcx-importer.js";
import { analyseTraining } from "../src/training-engine.js";

const tcx = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Biking"><Id>2026-09-19T08:00:00Z</Id><Lap StartTime="2026-09-19T08:00:00Z"><TotalTimeSeconds>3600</TotalTimeSeconds><DistanceMeters>30000</DistanceMeters><Calories>600</Calories><AverageHeartRateBpm><Value>130</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>160</Value></MaximumHeartRateBpm><Track><Trackpoint><Time>2026-09-19T08:00:00Z</Time><DistanceMeters>0</DistanceMeters><HeartRateBpm><Value>120</Value></HeartRateBpm><Extensions><TPX><Watts>180</Watts></TPX></Extensions></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
const activity = canonicalActivitiesFromTcx(tcx, { fileHash: "tcx-hash", fileName: "ride.tcx" })[0];
assert.equal(activity.sport, "ride");
assert.equal(activity.durationSeconds, 3600);
assert.equal(activity.distanceMeters, 30000);
assert.equal(activity.samples[0].power, 180);
const recent = { ...activity, startedAt: new Date().toISOString(), power: { ...activity.power, normalized: 200 }, metrics: { ...activity.metrics, trainingStress: null } };
const analysis = analyseTraining([recent], { days: 7, ftpWatts: 250 });
assert.equal(analysis.activityCount, 1);
assert.equal(analysis.load.ftpWatts, 250);
assert.ok(analysis.daily[0].load > 0);
console.log("TCX and training engine test passed: canonical TCX data and FTP-derived load work.");
