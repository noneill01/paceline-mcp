import assert from "node:assert/strict";
import { mergeLikelyDuplicates, normalizeGarminActivity, normalizeTrainingPeaksWorkout } from "../src/training-model.js";

const planned = normalizeTrainingPeaksWorkout({ id: "tp-1", date: "2026-09-18", type: "completed", sport: "Bike", title: "Endurance", duration_actual: 1.0, distance_actual_km: 30, tss_actual: 60 });
const recorded = normalizeGarminActivity({ id: "g-1", start_time: "2026-09-18 08:00:00", type: "cycling", name: "Morning Ride", duration_seconds: 3650, distance_meters: 30100, avg_hr_bpm: 130 });
const merged = mergeLikelyDuplicates([planned, recorded]);
assert.equal(merged.length, 1);
assert.deepEqual(merged[0].sourceProviders.sort(), ["Garmin Connect", "TrainingPeaks"]);
assert.equal(merged[0].providerIds.garmin, "g-1");
assert.equal(merged[0].providerIds.trainingPeaks, "tp-1");
console.log("Training model test passed: likely provider duplicates are merged.");
