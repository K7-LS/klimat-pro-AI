// Explicit production recovery verification. Uses only disposable test entities.
// Run on the Windows host with its existing root WSL access; never prints keys.
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const base = process.env.KP_E2E_BASE_URL;
if (!base || !base.startsWith("https://")) throw new Error("Set KP_E2E_BASE_URL to the restored HTTPS origin");
const raw = execFileSync("wsl.exe", ["-d", "Ubuntu", "-u", "root", "--exec", "grep", "-E",
  "^(ANON_KEY|SERVICE_ROLE_KEY)=", "/srv/supabase-src/docker/.env"], { encoding: "utf8" });
const keys = Object.fromEntries(raw.trim().split(/\r?\n/).map(line => {
  const split = line.indexOf("=");
  return [line.slice(0, split), line.slice(split + 1).replace(/^(['"])(.*)\1$/, "$2")];
}));
if (!keys.ANON_KEY || !keys.SERVICE_ROLE_KEY) throw new Error("Local Supabase keys unavailable");
const admin = createClient("http://127.0.0.1:8000", keys.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const checked = result => { if (result.error) throw result.error; return result.data; };
const prefix = `Klimat-Pro-recovery-E2E-${Date.now()}-${randomBytes(4).toString("hex")}`;
const email = `mcp-e2e-${randomBytes(12).toString("hex")}@klimat.local`;
const password = randomBytes(32).toString("base64url");
let userId;
let failure;
async function counts() {
  const users = checked(await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).users.length;
  const projects = await admin.from("projects").select("id", { count: "exact", head: true });
  checked(projects);
  return { users, projects: projects.count };
}
const before = await counts();
try {
  userId = checked(await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: prefix },
  })).user.id;
  checked(await admin.from("profiles").update({ role: "admin", approved: true }).eq("id", userId));
  checked(await admin.from("mcp_user_access").insert({ user_id: userId, access_level: "read" }));
  const run = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL("./live-oauth-e2e.mjs", import.meta.url))], {
      env: { ...process.env, KP_E2E_ANON_KEY: keys.ANON_KEY, KP_E2E_EMAIL: email,
        KP_E2E_PASSWORD: password, KP_E2E_CLIENT_NAME: prefix },
      stdio: ["ignore", "pipe", "pipe"], timeout: 120000,
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", value => { stdout += value; });
    child.stderr.on("data", value => { stderr += value; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
  if (run.code !== 0) {
    const safe = run.stderr.replaceAll(keys.SERVICE_ROLE_KEY, "[redacted]")
      .replaceAll(keys.ANON_KEY, "[redacted]").replaceAll(password, "[redacted]");
    throw new Error(`OAuth E2E failed (${run.code}): ${safe.slice(-2500)}`);
  }
  const proof = JSON.parse(run.stdout.trim());
  if (proof.ok !== true) throw new Error("OAuth E2E did not return success");
  process.stdout.write(JSON.stringify(proof) + "\n");
} catch (error) {
  failure = error;
} finally {
  // Exact generated names/IDs only, including cleanup after an interrupted test.
  checked(await admin.from("clients").delete().eq("name", `${prefix} record`));
  const clients = checked(await admin.auth.admin.oauth.listClients({ page: 1, perPage: 1000 }));
  for (const client of clients.clients ?? []) {
    if ((client.client_name ?? client.name) === prefix) checked(await admin.auth.admin.oauth.deleteClient(client.client_id ?? client.id));
  }
  if (userId) {
    checked(await admin.from("activity_log").delete().eq("actor_id", userId));
    checked(await admin.auth.admin.deleteUser(userId));
  }
}
const after = await counts();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("User/project counts changed during verification");
process.stdout.write(JSON.stringify({ cleanup: true, ...after }) + "\n");
if (failure) throw failure;
