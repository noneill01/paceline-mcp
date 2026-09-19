import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import FitParser from "fit-file-parser";
import { canonicalActivitiesFromFit } from "./activity-model.js";
import { openLocalActivityStore } from "./local-activity-store.js";
import { importTcxFile } from "./tcx-importer.js";

const fitParser = () => new FitParser({
  mode: "cascade",
  force: false,
  speedUnit: "m/s",
  lengthUnit: "m",
  temperatureUnit: "celsius",
  elapsedRecordField: true,
  includeRawDeveloperFields: true
});

const filesAt = async (path) => {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = resolve(path, entry.name);
    if (entry.isDirectory()) return filesAt(entryPath);
    return entry.isFile() && [".fit", ".tcx"].includes(extname(entry.name).toLowerCase()) ? [entryPath] : [];
  }));
  return nested.flat();
};

export async function importFitFile(path, { parser = fitParser(), store = openLocalActivityStore() } = {}) {
  const content = await readFile(path);
  const fileHash = createHash("sha256").update(content).digest("hex");
  if (store.hasFile(fileHash)) return { path, status: "duplicate", activityCount: 0, probableDuplicates: [], activities: [] };
  const parsed = await parser.parseAsync(content);
  const activities = canonicalActivitiesFromFit(parsed, { fileHash, fileName: basename(path) });
  const result = store.storeFileActivities(fileHash, activities);
  return { path, status: result.imported ? "imported" : "duplicate", activityCount: result.activityCount, probableDuplicates: result.probableDuplicates ?? [], activities: activities.map((activity) => ({ sport: activity.sport, startedAt: activity.startedAt })) };
}

export async function importActivityPath(path, options = {}) {
  const resolvedPath = resolve(path);
  const target = await import("node:fs/promises").then(({ stat }) => stat(resolvedPath));
  const files = target.isDirectory() ? await filesAt(resolvedPath) : [".fit", ".tcx"].includes(extname(resolvedPath).toLowerCase()) ? [resolvedPath] : [];
  if (!files.length) return { scannedFiles: 0, importedFiles: 0, duplicateFiles: 0, activityCount: 0, failures: [] };
  const store = options.store ?? openLocalActivityStore();
  try {
    const outcomes = [];
    for (const file of files) {
      try { outcomes.push(extname(file).toLowerCase() === ".tcx" ? await importTcxFile(file, { store }) : await importFitFile(file, { ...options, store })); }
      catch (error) { outcomes.push({ path: file, status: "failed", error: error instanceof Error ? error.message : String(error) }); }
    }
    return {
      scannedFiles: files.length,
      importedFiles: outcomes.filter((item) => item.status === "imported").length,
      duplicateFiles: outcomes.filter((item) => item.status === "duplicate").length,
      activityCount: outcomes.reduce((total, item) => total + (item.activityCount ?? 0), 0),
      probableDuplicates: outcomes.flatMap((item) => item.probableDuplicates ?? []),
      activities: outcomes.flatMap((item) => item.activities ?? []),
      failures: outcomes.filter((item) => item.status === "failed").map(({ path: failedPath, error }) => ({ path: failedPath, error }))
    };
  } finally {
    if (!options.store) store.close();
  }
}

export const importFitPath = importActivityPath;
