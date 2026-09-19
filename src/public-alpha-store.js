import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const assertText = (value, name) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
};

const publicAlphaKey = () => {
  const value = process.env.PACELINE_PUBLIC_ALPHA_ENCRYPTION_KEY ?? process.env.PUBLIC_ALPHA_ENCRYPTION_KEY;
  if (!value) throw new Error("Public-alpha storage is not configured. Set PACELINE_PUBLIC_ALPHA_ENCRYPTION_KEY to a base64-encoded 32-byte key.");
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

// This is intentionally a separate store from the private pilot database. A hosted
// deployment will replace SQLite with managed infrastructure, preserving this tenant API.
export function openPublicAlphaStore({ databasePath = process.env.PACELINE_PUBLIC_ALPHA_DB_PATH ?? process.env.PUBLIC_ALPHA_DB_PATH ?? ".local-data/paceline-public-alpha.sqlite", encryptionKey = publicAlphaKey() } = {}) {
  const key = Buffer.isBuffer(encryptionKey) ? encryptionKey : Buffer.from(encryptionKey, "base64");
  if (key.length !== 32) throw new Error("Public-alpha encryption key must be 32 bytes.");
  const absolutePath = resolve(databasePath);
  mkdirSync(dirname(absolutePath), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(absolutePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS athletes (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS provider_connections (
      athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'revoked')),
      consent_scopes TEXT NOT NULL,
      consented_at TEXT NOT NULL,
      revoked_at TEXT,
      credentials TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (athlete_id, provider)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS workouts (
      athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      date TEXT NOT NULL,
      providers TEXT NOT NULL,
      payload TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      PRIMARY KEY (athlete_id, id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY,
      athlete_id TEXT NOT NULL,
      action TEXT NOT NULL,
      provider TEXT,
      occurred_at TEXT NOT NULL
    ) STRICT;
  `);

  const audit = (athleteId, action, provider = null) => database.prepare("INSERT INTO audit_events (athlete_id, action, provider, occurred_at) VALUES (?, ?, ?, ?)").run(athleteId, action, provider, new Date().toISOString());
  const ensureAthlete = (athleteId) => {
    const id = assertText(athleteId, "Athlete ID");
    if (!database.prepare("SELECT 1 FROM athletes WHERE id = ?").get(id)) throw new Error("Athlete account was not found.");
    return id;
  };

  return {
    createAthlete(athleteId) {
      const id = assertText(athleteId, "Athlete ID");
      database.prepare("INSERT INTO athletes (id, created_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING").run(id, new Date().toISOString());
      return { athleteId: id };
    },
    grantConnection({ athleteId, provider, credentials, scopes = [] }) {
      const id = ensureAthlete(athleteId);
      const providerName = assertText(provider, "Provider");
      if (!credentials || typeof credentials !== "object") throw new Error("Encrypted provider credentials are required.");
      const now = new Date().toISOString();
      database.prepare("INSERT INTO provider_connections (athlete_id, provider, status, consent_scopes, consented_at, revoked_at, credentials, updated_at) VALUES (?, ?, 'active', ?, ?, NULL, ?, ?) ON CONFLICT(athlete_id, provider) DO UPDATE SET status='active', consent_scopes=excluded.consent_scopes, consented_at=excluded.consented_at, revoked_at=NULL, credentials=excluded.credentials, updated_at=excluded.updated_at").run(id, providerName, JSON.stringify(scopes), now, encrypt(credentials, key), now);
      audit(id, "provider_connected", providerName);
      return { athleteId: id, provider: providerName, status: "active", consentedAt: now };
    },
    getActiveConnection(athleteId, provider) {
      const id = ensureAthlete(athleteId);
      const providerName = assertText(provider, "Provider");
      const row = database.prepare("SELECT credentials, consent_scopes, consented_at FROM provider_connections WHERE athlete_id = ? AND provider = ? AND status = 'active'").get(id, providerName);
      return row ? { credentials: decrypt(row.credentials, key), scopes: JSON.parse(row.consent_scopes), consentedAt: row.consented_at } : null;
    },
    revokeConnection(athleteId, provider) {
      const id = ensureAthlete(athleteId);
      const providerName = assertText(provider, "Provider");
      const now = new Date().toISOString();
      const result = database.prepare("UPDATE provider_connections SET status='revoked', credentials=NULL, revoked_at=?, updated_at=? WHERE athlete_id=? AND provider=? AND status='active'").run(now, now, id, providerName);
      if (result.changes) audit(id, "provider_disconnected", providerName);
      return { athleteId: id, provider: providerName, disconnected: Boolean(result.changes) };
    },
    storeWorkouts(athleteId, workouts) {
      const id = ensureAthlete(athleteId);
      if (!Array.isArray(workouts)) throw new Error("Workouts must be an array.");
      const now = new Date().toISOString();
      const upsert = database.prepare("INSERT INTO workouts (athlete_id, id, date, providers, payload, synced_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(athlete_id, id) DO UPDATE SET date=excluded.date, providers=excluded.providers, payload=excluded.payload, synced_at=excluded.synced_at");
      database.exec("BEGIN");
      try {
        for (const workout of workouts) upsert.run(id, assertText(workout.id, "Workout ID"), assertText(workout.date, "Workout date"), JSON.stringify(workout.sourceProviders ?? []), encrypt(workout, key), now);
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
      audit(id, "workouts_synced");
      return { athleteId: id, workoutCount: workouts.length, syncedAt: now };
    },
    listWorkouts(athleteId, { limit = 100 } = {}) {
      const id = ensureAthlete(athleteId);
      const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
      return database.prepare("SELECT payload FROM workouts WHERE athlete_id = ? ORDER BY date DESC LIMIT ?").all(id, safeLimit).map((row) => decrypt(row.payload, key));
    },
    deleteAthleteData(athleteId) {
      const id = ensureAthlete(athleteId);
      const counts = {
        workouts: database.prepare("SELECT COUNT(*) AS count FROM workouts WHERE athlete_id = ?").get(id).count,
        connections: database.prepare("SELECT COUNT(*) AS count FROM provider_connections WHERE athlete_id = ?").get(id).count
      };
      database.exec("BEGIN");
      try {
        database.prepare("DELETE FROM workouts WHERE athlete_id = ?").run(id);
        database.prepare("DELETE FROM provider_connections WHERE athlete_id = ?").run(id);
        database.prepare("DELETE FROM audit_events WHERE athlete_id = ?").run(id);
        database.prepare("DELETE FROM athletes WHERE id = ?").run(id);
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
      return { athleteId: id, deleted: counts };
    },
    close() { database.close(); }
  };
}
