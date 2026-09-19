import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importFitFile } from "../src/fit-importer.js";
import { openLocalActivityStore } from "../src/local-activity-store.js";

const directory = mkdtempSync(join(tmpdir(), "paceline-fit-import-"));
const file = join(directory, "ride.fit");
writeFileSync(file, "test FIT fixture bytes");
const parsed = {
  sessions: [{
    start_time: new Date("2026-09-19T08:00:00Z"), sport: "cycling", total_timer_time: 3600, total_distance: 30000,
    total_ascent: 250, avg_heart_rate: 130, max_heart_rate: 160, avg_power: 180, normalized_power: 195,
    laps: [{ start_time: new Date("2026-09-19T08:00:00Z"), total_timer_time: 3600, total_distance: 30000, records: [
      { timestamp: new Date("2026-09-19T08:00:00Z"), distance: 0, heart_rate: 110, power: 150 },
      { timestamp: new Date("2026-09-19T09:00:00Z"), distance: 30000, heart_rate: 140, power: 200 }
    ] }]
  }],
  raw_developer_fields: [{ name: "example" }]
};
const parser = { parseAsync: async () => parsed };
const store = openLocalActivityStore({ databasePath: join(directory, "activities.sqlite"), encryptionKey: randomBytes(32) });
const first = await importFitFile(file, { parser, store });
assert.deepEqual(first.status, "imported");
assert.equal(first.activityCount, 1);
const activity = store.listActivities()[0];
assert.equal(activity.sport, "ride");
assert.equal(activity.samples.length, 2);
assert.equal(activity.laps.length, 1);
assert.equal(activity.power.normalized, 195);
assert.equal(activity.sourceData.developerFields.length, 1);
const second = await importFitFile(file, { parser, store });
assert.equal(second.status, "duplicate");
const matchingExport = join(directory, "matching-export.fit");
writeFileSync(matchingExport, "different file bytes for the same activity");
const semanticDuplicate = await importFitFile(matchingExport, { parser, store });
assert.equal(semanticDuplicate.probableDuplicates.length, 1);
store.close();
console.log("FIT importer test passed: canonical mapping and hash duplicate detection work.");
