import { listCombinedWorkouts } from "./combined-coach.js";
import { openEncryptedStore } from "./storage.js";

export async function syncPrivateAlphaData({ days = 28, includeStrava = false } = {}) {
  const combined = await listCombinedWorkouts(days, includeStrava);
  const store = openEncryptedStore();
  try {
    return { ...store.recordSync({ providers: combined.providers, workouts: combined.workouts }), providers: combined.providers, strava: combined.strava };
  } finally { store.close(); }
}

export function getStoredWorkouts(limit = 100) {
  const store = openEncryptedStore();
  try { return { workouts: store.listWorkouts({ limit }), latestSync: store.latestSync() }; }
  finally { store.close(); }
}
