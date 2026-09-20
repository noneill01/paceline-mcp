import assert from "node:assert/strict";
import { resolveAthleteProfile, trainingZones } from "../src/athlete-profile.js";
import { activityIntensityDistribution, periodIntensityDistribution } from "../src/zones.js";

const profile = resolveAthleteProfile({ ftpWatts: 250, lactateThresholdHeartRate: 160 }, {});
const zones = trainingZones(profile);
assert.equal(zones.power.status, "available");
assert.equal(zones.power.zones.length, 7);
assert.equal(zones.heartRate.status, "available");
assert.equal(zones.heartRate.zones.length, 5);

const activity = {
  id: "test:ride", sport: "ride",
  samples: [
    { timestamp: "2026-09-20T08:00:00Z", power: 100, heart_rate: 110 },
    { timestamp: "2026-09-20T08:00:30Z", power: 160, heart_rate: 135 },
    { timestamp: "2026-09-20T08:01:00Z", power: 270, heart_rate: 155 },
    { timestamp: "2026-09-20T08:01:30Z", power: 330, heart_rate: 165 }
  ]
};
const distribution = activityIntensityDistribution(activity, profile);
assert.equal(distribution.power.status, "available");
assert.equal(distribution.power.totalSeconds, 90);
assert.equal(distribution.power.zones.find((zone) => zone.id === "Z1").seconds, 30);
assert.equal(distribution.intensity.easy.seconds, 60);
assert.equal(distribution.intensity.hard.seconds, 30);
assert.equal(distribution.heartRate.status, "available");
assert.equal(distribution.heartRate.totalSeconds, 90);

const period = periodIntensityDistribution([activity], profile);
assert.equal(period.activitiesWithPowerSamples, 1);
assert.equal(period.power.totalSeconds, 90);
const unavailable = activityIntensityDistribution(activity, {});
assert.equal(unavailable.power.status, "unavailable");
assert.equal(unavailable.heartRate.status, "unavailable");
console.log("Zones test passed: deterministic power and heart-rate time-in-zone distributions work.");
