import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { openLocalActivityStore } from "./local-activity-store.js";

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const sport = (value) => ({ running: "run", biking: "ride", cycling: "ride", swimming: "swim", strength: "strength" }[String(value ?? "").toLowerCase()] ?? "other");
const blockPattern = (tag) => new RegExp(`<(?:(?:[\w-]+):)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[\w-]+):)?${tag}>`, "gi");
const blocks = (xml, tag) => [...xml.matchAll(blockPattern(tag))].map((match) => match[1]);
const openingAttributes = (xml, tag) => [...xml.matchAll(new RegExp(`<(?:(?:[\w-]+):)?${tag}\\b([^>]*)>`, "gi"))].map((match) => match[1]);
const tagText = (xml, tag) => blocks(xml, tag)[0]?.trim() ?? null;
const attribute = (xml, name) => xml.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1] ?? null;
const optionalNumber = (name, value) => number(value) == null ? {} : { [name]: number(value) };

const samples = (lapXml) => blocks(lapXml, "Trackpoint").map((point) => ({
  timestamp: tagText(point, "Time"),
  ...optionalNumber("position_lat", tagText(blocks(point, "Position")[0] ?? "", "LatitudeDegrees")),
  ...optionalNumber("position_long", tagText(blocks(point, "Position")[0] ?? "", "LongitudeDegrees")),
  ...optionalNumber("altitude", tagText(point, "AltitudeMeters")),
  ...optionalNumber("distance", tagText(point, "DistanceMeters")),
  ...optionalNumber("heart_rate", tagText(blocks(point, "HeartRateBpm")[0] ?? "", "Value")),
  ...optionalNumber("cadence", tagText(point, "Cadence")),
  ...optionalNumber("power", tagText(point, "Watts"))
}));

export function canonicalActivitiesFromTcx(xml, { fileHash, fileName }) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("TCX files containing DTD or entity declarations are not supported.");
  const activities = blocks(xml, "Activity");
  if (!activities.length) throw new Error("The TCX file did not contain an activity.");
  return activities.map((activityXml, index) => {
    const sourceLaps = blocks(activityXml, "Lap");
    const lapAttributes = openingAttributes(activityXml, "Lap");
    const activitySamples = sourceLaps.flatMap(samples).filter((point) => point.timestamp);
    const laps = sourceLaps.map((lap, lapIndex) => ({
      startedAt: attribute(lapAttributes[lapIndex] ?? "", "StartTime"), durationSeconds: number(tagText(lap, "TotalTimeSeconds")), distanceMeters: number(tagText(lap, "DistanceMeters")),
      heartRate: { average: number(tagText(blocks(lap, "AverageHeartRateBpm")[0] ?? "", "Value")), maximum: number(tagText(blocks(lap, "MaximumHeartRateBpm")[0] ?? "", "Value")) },
      cadence: { average: number(tagText(lap, "Cadence")), maximum: null }, power: { average: null, maximum: null, normalized: null }
    }));
    const startedAt = laps[0]?.startedAt ?? activitySamples[0]?.timestamp;
    if (!startedAt) throw new Error("The TCX activity did not include a usable start time.");
    return {
      schemaVersion: 1, id: `tcx:${fileHash}:${index}`, source: { type: "tcx_file", fileHash, fileName, sessionIndex: index }, sport: sport(attribute(openingAttributes(xml, "Activity")[index] ?? "", "Sport")), startedAt,
      durationSeconds: laps.reduce((total, lap) => total + (lap.durationSeconds ?? 0), 0), distanceMeters: laps.reduce((total, lap) => total + (lap.distanceMeters ?? 0), 0), elevationGainMeters: null,
      heartRate: { average: null, maximum: Math.max(...laps.map((lap) => lap.heartRate.maximum ?? 0), 0) || null }, power: { average: null, maximum: null, normalized: null }, cadence: { average: null, maximum: null },
      laps, samples: activitySamples, metrics: { calories: number(sourceLaps.reduce((total, lap) => total + (number(lap.Calories) ?? 0), 0)), trainingEffect: null, anaerobicTrainingEffect: null, intensityFactor: null, trainingStress: null },
      sourceData: { providerActivityId: tagText(activityXml, "Id"), subSport: null, developerFields: [] }
    };
  });
}

export async function importTcxFile(path, { store = openLocalActivityStore() } = {}) {
  const content = await readFile(path);
  const fileHash = createHash("sha256").update(content).digest("hex");
  if (store.hasFile(fileHash)) return { path, status: "duplicate", activityCount: 0, probableDuplicates: [], activities: [] };
  if (content.length > 50 * 1024 * 1024) throw new Error("TCX file is larger than the 50 MB local import limit.");
  const activities = canonicalActivitiesFromTcx(content.toString("utf8"), { fileHash, fileName: basename(path) });
  const result = store.storeFileActivities(fileHash, activities);
  return { path, status: result.imported ? "imported" : "duplicate", activityCount: result.activityCount, probableDuplicates: result.probableDuplicates ?? [], activities: activities.map((activity) => ({ sport: activity.sport, startedAt: activity.startedAt })) };
}
