import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openEncryptedStore } from "../src/storage.js";

const directory = mkdtempSync(join(tmpdir(), "training-coach-storage-"));
const store = openEncryptedStore({ databasePath: join(directory, "test.sqlite"), encryptionKey: randomBytes(32) });
const result = store.recordSync({ providers: ["Garmin Connect"], workouts: [{ id: "garmin:1", date: "2026-09-18", sourceProviders: ["Garmin Connect"], title: "Test" }] });
assert.equal(result.workoutCount, 1);
assert.equal(store.listWorkouts()[0].title, "Test");
assert.equal(store.latestSync().status, "succeeded");
store.setConnection("strava", { refreshToken: "test-token" });
assert.equal(store.getConnection("strava").refreshToken, "test-token");
store.close();
console.log("Encrypted storage test passed: a sync record and encrypted workout round-trip correctly.");
