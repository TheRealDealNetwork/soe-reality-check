/**
 * Session store: API when server is available, localStorage fallback for offline.
 * Multi-device on same LAN works via server.py.
 */

const LS_KEY = "soe-rc-sessions-v1";
const LS_HOST_AUTH = "soe-rc-host-auth";

function uid() {
  return (
    "r_" +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  );
}

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocal(all) {
  localStorage.setItem(LS_KEY, JSON.stringify(all));
  try {
    window.dispatchEvent(new CustomEvent("soe-rc-update", { detail: all }));
  } catch {
    /* ignore */
  }
}

function ensureSession(all, sessionId) {
  const id = String(sessionId || "").trim().toUpperCase();
  if (!id) throw new Error("Session ID required");
  if (!all[id]) {
    all[id] = {
      id,
      createdAt: new Date().toISOString(),
      responses: [],
    };
  }
  return all[id];
}

/** Try API first; fall back to localStorage. */
async function api(path, opts) {
  try {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      ...opts,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    return await res.json();
  } catch (e) {
    if (e.message && !e.message.includes("Failed to fetch") && !e.message.includes("NetworkError")) {
      /* rethrow application errors when we got a response shape */
    }
    throw e;
  }
}

let apiAvailable = null;

export async function checkApi() {
  if (apiAvailable !== null) return apiAvailable;
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    apiAvailable = res.ok;
  } catch {
    apiAvailable = false;
  }
  return apiAvailable;
}

export async function getSession(sessionId) {
  const id = String(sessionId || "").trim().toUpperCase();
  if (await checkApi()) {
    try {
      return await api(`/api/session/${encodeURIComponent(id)}`);
    } catch {
      /* fall through */
    }
  }
  const all = readLocal();
  return ensureSession(all, id);
}

export async function submitResponse(sessionId, payload) {
  const id = String(sessionId || "").trim().toUpperCase();
  const body = {
    id: uid(),
    role: payload.role,
    seat: payload.seat || null,
    answers: payload.answers,
    byGear: payload.byGear,
    overall: payload.overall,
    completedAt: new Date().toISOString(),
  };

  if (await checkApi()) {
    try {
      return await api(`/api/session/${encodeURIComponent(id)}/response`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.warn("API submit failed, using localStorage", e);
    }
  }

  const all = readLocal();
  const session = ensureSession(all, id);
  session.responses.push(body);
  writeLocal(all);
  return { session, response: body };
}

export function aggregate(session) {
  const responses = (session && session.responses) || [];
  const completed = responses.filter((r) => r.overall !== null && r.overall !== undefined);

  function groupAvg(roleGroup) {
    const rows = completed.filter((r) => r.role === roleGroup);
    if (!rows.length) return { n: 0, overall: null, byGear: {} };
    const overall =
      Math.round(rows.reduce((s, r) => s + (r.overall || 0), 0) / rows.length) || 0;
    const byGear = {};
    const gears = new Set();
    rows.forEach((r) => Object.keys(r.byGear || {}).forEach((g) => gears.add(g)));
    for (const g of gears) {
      const vals = rows
        .map((r) => (r.byGear || {})[g])
        .filter((v) => v !== null && v !== undefined);
      byGear[g] = vals.length
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        : null;
    }
    return { n: rows.length, overall, byGear };
  }

  const owners = groupAvg("owner");
  const managers = groupAvg("manager");

  return {
    total: responses.length,
    completed: completed.length,
    owners,
    managers,
    responses: completed,
  };
}

export function isHostAuthed(sessionId) {
  try {
    const map = JSON.parse(sessionStorage.getItem(LS_HOST_AUTH) || "{}");
    return !!map[String(sessionId || "").trim().toUpperCase()];
  } catch {
    return false;
  }
}

export function setHostAuthed(sessionId, ok) {
  const id = String(sessionId || "").trim().toUpperCase();
  let map = {};
  try {
    map = JSON.parse(sessionStorage.getItem(LS_HOST_AUTH) || "{}");
  } catch {
    map = {};
  }
  if (ok) map[id] = true;
  else delete map[id];
  sessionStorage.setItem(LS_HOST_AUTH, JSON.stringify(map));
}

export function seedDemoIfEmpty(sessionId) {
  const id = String(sessionId || "").trim().toUpperCase();
  const all = readLocal();
  const session = ensureSession(all, id);
  if (session.responses.length) return session;

  const samples = [
    {
      role: "owner",
      seat: null,
      overall: 62,
      byGear: {
        leader: 75, people: 50, marketing: 50, appointments: 75,
        sales: 50, production: 75, money: 50, machine: 50,
      },
    },
    {
      role: "owner",
      seat: null,
      overall: 48,
      byGear: {
        leader: 50, people: 50, marketing: 25, appointments: 50,
        sales: 50, production: 75, money: 25, machine: 50,
      },
    },
    {
      role: "manager",
      seat: "sales",
      overall: 71,
      byGear: {
        leader: 75, people: 75, marketing: 50, appointments: 75,
        sales: 100, production: 50, money: 50, machine: 75,
      },
    },
    {
      role: "manager",
      seat: "production",
      overall: 58,
      byGear: {
        leader: 50, people: 50, marketing: 25, appointments: 50,
        sales: 50, production: 100, money: 50, machine: 75,
      },
    },
    {
      role: "manager",
      seat: "recruiting",
      overall: 54,
      byGear: {
        leader: 50, people: 100, marketing: 25, appointments: 50,
        sales: 50, production: 50, money: 25, machine: 50,
      },
    },
  ];

  for (const s of samples) {
    session.responses.push({
      id: uid(),
      ...s,
      answers: {},
      completedAt: new Date().toISOString(),
      demo: true,
    });
  }
  writeLocal(all);
  return session;
}

export function clearSessionLocal(sessionId) {
  const id = String(sessionId || "").trim().toUpperCase();
  const all = readLocal();
  delete all[id];
  writeLocal(all);
}

export async function clearSession(sessionId) {
  const id = String(sessionId || "").trim().toUpperCase();
  if (await checkApi()) {
    try {
      await api(`/api/session/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      /* fall through */
    }
  }
  clearSessionLocal(id);
}
