import http from "node:http";
import { randomBytes } from "node:crypto";
import { openEncryptedStore } from "../src/storage.js";

const { STRAVA_CLIENT_ID: clientId, STRAVA_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) throw new Error("Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env before authorizing Strava.");

const redirectUri = "http://localhost:8787/strava/callback";
const state = randomBytes(24).toString("hex");
const authorizationUrl = new URL("https://www.strava.com/oauth/authorize");
authorizationUrl.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", approval_prompt: "auto", scope: "read,activity:read_all", state }).toString();

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, redirectUri);
  if (url.pathname !== "/strava/callback" || url.searchParams.get("state") !== state || !url.searchParams.get("code")) {
    response.writeHead(400); response.end("Strava authorization could not be verified. You may close this page."); return;
  }
  try {
    const tokenResponse = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: url.searchParams.get("code"), grant_type: "authorization_code" }) });
    if (!tokenResponse.ok) throw new Error(`Strava token exchange failed (${tokenResponse.status}).`);
    const token = await tokenResponse.json();
    const store = openEncryptedStore();
    try { store.setConnection("strava", { refreshToken: token.refresh_token, athlete: token.athlete ?? null, scope: url.searchParams.get("scope") }); } finally { store.close(); }
    response.writeHead(200, { "content-type": "text/html" }); response.end("<h1>Strava connected</h1><p>You can close this window and return to PaceLine.</p>");
    console.log("Strava authorization succeeded. The refresh token was saved in encrypted local storage.");
  } catch (error) {
    response.writeHead(500); response.end("Strava connection failed. Return to the terminal for details."); console.error(error.message);
  } finally { server.close(); }
});

server.listen(8787, "127.0.0.1", () => console.log(`Open this URL in your browser to authorize Strava:\n${authorizationUrl}`));
