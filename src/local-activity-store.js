import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { activityFingerprint, likelySameActivity } from "./activity-fingerprint.js";

const keyFromEnvironment = () => {
  const value = process.env.TRAINING_COACH_ENCRYPTION_KEY;
  if (!value) throw new Error("Local activity storage is not configured. Run paceline-mcp init first.");
  return Buffer.from(value, "base64");
};
const encrypt = (value, key) => {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString("base64");
};
const decrypt = (value, key) => {
  const payload = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8"));
};

export function openLocalActivityStore({ databasePath = process.env.PACELINE_ACTIVITY_DB_PATH ?? ".local-data/paceline-activities.sqlite", encryptionKey = keyFromEnvironment() } = {}) {
  const key = Buffer.isBuffer(encryptionKey) ? encryptionKey : Buffer.from(encryptionKey, "base64");
  if (key.length !== 32) throw new Error("Local activity encryption key must be 32 bytes.");
  const absolutePath = resolve(databasePath);
  mkdirSync(dirname(absolutePath), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(absolutePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS imported_files (file_hash TEXT PRIMARY KEY, imported_at TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, sport TEXT NOT NULL, payload TEXT NOT NULL, imported_at TEXT NOT NULL) STRICT;
  `);
  return {
    hasFile(fileHash) { return Boolean(database.prepare("SELECT 1 FROM imported_files WHERE file_hash = ?").get(fileHash)); },
    storeFileActivities(fileHash, activities) {
      if (this.hasFile(fileHash)) return { imported: false, activityCount: 0 };
      const now = new Date().toISOString();
      const existing = database.prepare("SELECT payload FROM activities").all().map((row) => decrypt(row.payload, key));
      const probableDuplicates = activities.flatMap((activity) => existing.filter((candidate) => likelySameActivity(candidate, activity)).map((candidate) => ({ activityId: activity.id, possibleDuplicateOf: candidate.id, fingerprint: activityFingerprint(activity) })));
      const insert = database.prepare("INSERT INTO activities (id, started_at, sport, payload, imported_at) VALUES (?, ?, ?, ?, ?)");
      database.exec("BEGIN");
      try {
        for (const activity of activities) insert.run(activity.id, activity.startedAt, activity.sport, encrypt(activity, key), now);
        database.prepare("INSERT INTO imported_files (file_hash, imported_at) VALUES (?, ?)").run(fileHash, now);
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
      return { imported: true, activityCount: activities.length, probableDuplicates };
    },
    listActivities({ limit = 50 } = {}) {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 500));
      return database.prepare("SELECT payload FROM activities ORDER BY started_at DESC LIMIT ?").all(safeLimit).map((row) => decrypt(row.payload, key));
    },
    getActivity(id) {
      const row = database.prepare("SELECT payload FROM activities WHERE id = ?").get(id);
      return row ? decrypt(row.payload, key) : null;
    },
    close() { database.close(); }
  };
}
