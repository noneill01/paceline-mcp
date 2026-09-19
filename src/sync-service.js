import { listCombinedWorkouts } from "./combined-coach.js";
import { openEncryptedStore } from "./storage.js";

export async function syncPrivateAlphaData({ days = 28 } = {}) {
  const combined = await listCombinedWorkouts(days);
  const store = openEncryptedStore();
  try {
    return { ...store.recordSync({ providers: combined.providers, workouts: combined.workouts }), providers: combined.providers };
  } finally { store.close(); }
}

export function getStoredWorkouts(limit = 100) {
  const store = openEncryptedStore();
  try { return { workouts: store.listWorkouts({ limit }), latestSync: store.latestSync() }; }
  finally { store.close(); }
}
