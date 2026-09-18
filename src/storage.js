import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const keyFromEnvironment = () => {
  const value = process.env.TRAINING_COACH_ENCRYPTION_KEY;
  if (!value) throw new Error("Encrypted storage is not configured. Set TRAINING_COACH_ENCRYPTION_KEY to a base64-encoded 32-byte key.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("TRAINING_COACH_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
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

export function openEncryptedStore({ databasePath = process.env.TRAINING_COACH_DB_PATH ?? ".local-data/training-coach.sqlite", encryptionKey = keyFromEnvironment() } = {}) {
  const absolutePath = resolve(databasePath);
  mkdirSync(dirname(absolutePath), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(absolutePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      providers TEXT NOT NULL,
      payload TEXT NOT NULL,
      synced_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sync_runs (
      id INTEGER PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      providers TEXT NOT NULL,
      workout_count INTEGER NOT NULL DEFAULT 0,
      message TEXT
    ) STRICT;
  `);
  const key = Buffer.isBuffer(encryptionKey) ? encryptionKey : Buffer.from(encryptionKey, "base64");
  if (key.length !== 32) throw new Error("Storage encryption key must be 32 bytes.");

  return {
    recordSync({ providers, workouts, message = null }) {
      const now = new Date().toISOString();
      database.prepare("INSERT INTO sync_runs (started_at, finished_at, status, providers, workout_count, message) VALUES (?, ?, 'succeeded', ?, ?, ?)").run(now, now, JSON.stringify(providers), workouts.length, message);
      const upsert = database.prepare("INSERT INTO workouts (id, date, providers, payload, synced_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET date=excluded.date, providers=excluded.providers, payload=excluded.payload, synced_at=excluded.synced_at");
      database.exec("BEGIN");
      try {
        for (const workout of workouts) upsert.run(workout.id, workout.date, JSON.stringify(workout.sourceProviders), encrypt(workout, key), now);
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
      return { syncedAt: now, workoutCount: workouts.length };
    },
    listWorkouts({ limit = 100 } = {}) {
      return database.prepare("SELECT payload FROM workouts ORDER BY date DESC LIMIT ?").all(limit).map((row) => decrypt(row.payload, key));
    },
    latestSync() {
      return database.prepare("SELECT started_at, finished_at, status, providers, workout_count, message FROM sync_runs ORDER BY id DESC LIMIT 1").get() ?? null;
    },
    close() { database.close(); }
  };
}
