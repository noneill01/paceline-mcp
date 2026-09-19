const number = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
const iso = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const sport = (value) => {
  const name = String(value ?? "other").toLowerCase();
  if (name.includes("cycl") || name === "bike") return "ride";
  if (name.includes("run")) return "run";
  if (name.includes("swim")) return "swim";
  if (name.includes("strength")) return "strength";
  return "other";
};

const pickNumbers = (input, fields) => Object.fromEntries(fields.flatMap((field) => number(input?.[field]) == null ? [] : [[field, number(input[field])]]));

const sample = (record) => ({
  timestamp: iso(record.timestamp ?? record.compressed_timestamp),
  ...pickNumbers(record, ["position_lat", "position_long", "altitude", "enhanced_altitude", "distance", "speed", "enhanced_speed", "heart_rate", "cadence", "power", "temperature", "grade", "vertical_speed"])
});

const lap = (source) => ({
  startedAt: iso(source.start_time),
  durationSeconds: number(source.total_timer_time ?? source.total_elapsed_time),
  distanceMeters: number(source.total_distance),
  elevationGainMeters: number(source.total_ascent),
  heartRate: { average: number(source.avg_heart_rate), maximum: number(source.max_heart_rate) },
  power: { average: number(source.avg_power), maximum: number(source.max_power), normalized: number(source.normalized_power) },
  cadence: { average: number(source.avg_cadence), maximum: number(source.max_cadence) }
});

const sourceSessions = (parsed) => parsed.activity?.sessions ?? parsed.sessions ?? [];
const sessionLaps = (session, parsed) => session.laps ?? (parsed.laps ?? []).filter((item) => item.start_time && (!session.start_time || new Date(item.start_time) >= new Date(session.start_time)));
const sessionRecords = (session, parsed) => {
  if (session.records?.length) return session.records;
  const lapRecords = sessionLaps(session, parsed).flatMap((item) => item.records ?? []);
  return lapRecords.length ? lapRecords : parsed.records ?? [];
};

// Canonical format used by file imports and future provider adapters.
export function canonicalActivitiesFromFit(parsed, { fileHash, fileName }) {
  const sessions = sourceSessions(parsed);
  if (!sessions.length) throw new Error("The FIT file did not contain an activity session.");
  return sessions.map((session, index) => {
    const laps = sessionLaps(session, parsed).map(lap);
    const samples = sessionRecords(session, parsed).map(sample).filter((item) => item.timestamp);
    const startedAt = iso(session.start_time) ?? samples[0]?.timestamp;
    if (!startedAt) throw new Error("The FIT session did not include a usable start time.");
    return {
      schemaVersion: 1,
      id: `fit:${fileHash}:${index}`,
      source: { type: "fit_file", fileHash, fileName, sessionIndex: index },
      sport: sport(session.sport),
      startedAt,
      durationSeconds: number(session.total_timer_time ?? session.total_elapsed_time),
      distanceMeters: number(session.total_distance),
      elevationGainMeters: number(session.total_ascent),
      heartRate: { average: number(session.avg_heart_rate), maximum: number(session.max_heart_rate) },
      power: { average: number(session.avg_power), maximum: number(session.max_power), normalized: number(session.normalized_power) },
      cadence: { average: number(session.avg_cadence), maximum: number(session.max_cadence) },
      laps,
      samples,
      metrics: {
        calories: number(session.total_calories),
        trainingEffect: number(session.total_training_effect),
        anaerobicTrainingEffect: number(session.total_anaerobic_training_effect),
        intensityFactor: number(session.intensity_factor),
        trainingStress: number(session.training_stress_score ?? session.training_stress)
      },
      sourceData: {
        providerActivityId: session.activity_id == null ? null : String(session.activity_id),
        subSport: session.sub_sport ?? null,
        developerFields: parsed.raw_developer_fields ?? []
      }
    };
  });
}
