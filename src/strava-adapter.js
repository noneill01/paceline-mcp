import { normalizeStravaActivity } from "./training-model.js";

const configuration = () => ({
  clientId: process.env.STRAVA_CLIENT_ID,
  clientSecret: process.env.STRAVA_CLIENT_SECRET,
  refreshToken: process.env.STRAVA_REFRESH_TOKEN
});

export function getStravaConnectionStatus() {
  const config = configuration();
  return {
    provider: "Strava",
    connected: Boolean(config.clientId && config.clientSecret && config.refreshToken),
    missing: [!config.clientId && "STRAVA_CLIENT_ID", !config.clientSecret && "STRAVA_CLIENT_SECRET", !config.refreshToken && "STRAVA_REFRESH_TOKEN"].filter(Boolean),
    note: "Uses Strava's official OAuth refresh-token flow. Credentials are read only from environment variables and are never returned by this MCP."
  };
}

async function accessToken() {
  const config = configuration();
  if (!config.clientId || !config.clientSecret || !config.refreshToken) throw new Error("Strava is not connected. Configure the missing values reported by get_strava_connection_status.");
  const response = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken, grant_type: "refresh_token" }) });
  if (!response.ok) throw new Error(`Strava token refresh failed (${response.status}).`);
  return (await response.json()).access_token;
}

export async function listStravaWorkouts({ after, before } = {}) {
  const token = await accessToken();
  const query = new URLSearchParams({ per_page: "100" });
  if (after) query.set("after", String(Math.floor(new Date(`${after}T00:00:00Z`).getTime() / 1000)));
  if (before) query.set("before", String(Math.floor(new Date(`${before}T23:59:59Z`).getTime() / 1000)));
  const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?${query}`, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Strava activity request failed (${response.status}).`);
  return { source: "Strava", workouts: (await response.json()).map(normalizeStravaActivity) };
}
