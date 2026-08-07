/**
 * SOE Business Machine Reality Check — SPA
 * Routes:
 *   /                              join / home
 *   /benchmarking-event/:sessionId participant
 *   /host/:sessionId               host dashboard
 */

import {
  HOST_KEY,
  ROLES,
  MANAGER_SEATS,
  SCALE,
  GEARS,
  allQuestions,
  scoreAll,
  bandLabel,
  demoSessionId,
} from "./data.js";
import {
  getSession,
  submitResponse,
  aggregate,
  isHostAuthed,
  setHostAuthed,
  seedDemoIfEmpty,
  clearSession,
  checkApi,
} from "./store.js";

const QUESTIONS = allQuestions();
const PAGE_SIZE = 4;

const state = {
  route: { name: "home", sessionId: null },
  role: null,
  seat: null,
  answers: {},
  page: 0,
  result: null,
  hostSession: null,
  hostAgg: null,
  pollTimer: null,
  apiOk: false,
};

const $ = (sel, el = document) => el.querySelector(sel);
const app = () => $("#app");

function toast(msg) {
  let t = $(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* —— Router —— */
function parseRoute() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  let m;
  if ((m = path.match(/^\/benchmarking-event\/([^/]+)$/i))) {
    return { name: "event", sessionId: decodeURIComponent(m[1]).toUpperCase() };
  }
  if ((m = path.match(/^\/host\/([^/]+)$/i))) {
    return { name: "host", sessionId: decodeURIComponent(m[1]).toUpperCase() };
  }
  // Hash fallback for plain static servers
  const hash = location.hash.replace(/^#/, "");
  if ((m = hash.match(/^\/?benchmarking-event\/([^/]+)$/i))) {
    return { name: "event", sessionId: decodeURIComponent(m[1]).toUpperCase() };
  }
  if ((m = hash.match(/^\/?host\/([^/]+)$/i))) {
    return { name: "host", sessionId: decodeURIComponent(m[1]).toUpperCase() };
  }
  return { name: "home", sessionId: null };
}

function navigate(path, replace = false) {
  if (replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  onRoute();
}

function onRoute() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  state.route = parseRoute();
  // reset participant flow when entering event
  if (state.route.name === "event") {
    state.role = null;
    state.seat = null;
    state.answers = {};
    state.page = 0;
    state.result = null;
  }
  render();
}

/* —— Shell —— */
function shell(inner, { wide = false, sessionId = null, mode = "" } = {}) {
  return `
    <header class="app-header">
      <a class="brand" href="/" data-nav="/">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="6" fill="#1B3A5C"/>
            <path d="M10 28V12h4.2c3.6 0 5.8 1.7 5.8 4.4 0 1.7-.9 3.1-2.4 3.8L22 28h-4.2l-3.6-6.8H14V28H10zm4-10.2h1.5c1.4 0 2.2-.7 2.2-1.8s-.8-1.8-2.2-1.8H14v3.6zM24 28V12h3.6l4.8 10.2V12H36v16h-3.6L27.6 17.8V28H24z" fill="#F26522"/>
          </svg>
        </span>
        <span class="brand-text">
          <strong>School of Entrepreneurship</strong>
          <span>Business Machine Reality Check</span>
        </span>
      </a>
      <div class="header-meta">
        ${sessionId ? `<div>Session <strong>${escapeHtml(sessionId)}</strong></div>` : ""}
        ${mode ? `<div>${escapeHtml(mode)}</div>` : ""}
      </div>
    </header>
    <main class="${wide ? "wide" : ""}">${inner}</main>
    <div class="footer-note">soebluecollar.org · Private scores · Host sees group averages only</div>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* —— Home —— */
function renderHome() {
  const demo = demoSessionId();
  app().innerHTML = shell(`
    <section class="card">
      <p class="eyebrow">Live group diagnostic</p>
      <h1>Business Machine Reality Check</h1>
      <p class="lead">
        Enter your session code from the room. Answer short practice questions.
        You see your private score. The host sees the group average and strongest and weakest gears.
      </p>
      <div class="field">
        <label for="session-id">Session ID</label>
        <input id="session-id" type="text" placeholder="e.g. TEST-001" autocomplete="off" />
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" id="btn-demo">Use demo ${demo}</button>
        <button type="button" class="btn btn-primary" id="btn-join">Join session</button>
      </div>
    </section>
    <section class="card">
      <h2>Facilitators</h2>
      <p class="lead" style="margin-bottom:0.75rem">Open the host dashboard for a session. Host key required.</p>
      <div class="field">
        <label for="host-session">Session ID</label>
        <input id="host-session" type="text" placeholder="e.g. TEST-001" autocomplete="off" />
      </div>
      <div class="btn-row">
        <span class="muted">Host key is set by your event lead.</span>
        <button type="button" class="btn btn-secondary" id="btn-host">Open host view</button>
      </div>
    </section>
  `);

  $("#btn-join").onclick = () => {
    const id = ($("#session-id").value || "").trim().toUpperCase();
    if (!id) return toast("Enter a session ID");
    navigate(`/benchmarking-event/${encodeURIComponent(id)}`);
  };
  $("#btn-demo").onclick = () => {
    navigate(`/benchmarking-event/${demo}`);
  };
  $("#session-id").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#btn-join").click();
  });
  $("#btn-host").onclick = () => {
    const id = ($("#host-session").value || "").trim().toUpperCase() || demo;
    navigate(`/host/${encodeURIComponent(id)}`);
  };
  wireNav();
}

/* —— Participant —— */
function renderEvent() {
  const sid = state.route.sessionId;
  if (!state.result && !state.role) {
    renderRolePick(sid);
    return;
  }
  if (!state.result && state.role === "manager" && !state.seat) {
    renderSeatPick(sid);
    return;
  }
  if (state.result) {
    renderPrivateResults(sid);
    return;
  }
  renderQuestions(sid);
}

function renderRolePick(sid) {
  app().innerHTML = shell(
    `
    <section class="card">
      <p class="eyebrow">Step 1 of 3</p>
      <h1>Who are you today?</h1>
      <p class="lead">Pick the seat that best matches how you show up in the company. Answer from real life this week.</p>
      <div class="role-grid" id="roles">
        ${ROLES.map(
          (r) => `
          <button type="button" class="role-card" data-role="${r.id}">
            <strong>${escapeHtml(r.label)}</strong>
            <span>${escapeHtml(r.blurb)}</span>
          </button>`
        ).join("")}
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" data-nav="/">Back</button>
        <button type="button" class="btn btn-primary" id="btn-role-next" disabled>Continue</button>
      </div>
    </section>
  `,
    { sessionId: sid, mode: "Participant" }
  );

  let pick = null;
  $("#roles").onclick = (e) => {
    const btn = e.target.closest("[data-role]");
    if (!btn) return;
    pick = btn.dataset.role;
    $$(".role-card").forEach((el) => el.classList.toggle("selected", el.dataset.role === pick));
    $("#btn-role-next").disabled = !pick;
  };
  $("#btn-role-next").onclick = () => {
    state.role = pick;
    state.seat = pick === "owner" ? null : null;
    if (pick === "manager") {
      render();
    } else {
      state.page = 0;
      render();
    }
  };
  wireNav();
}

function $$(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function renderSeatPick(sid) {
  app().innerHTML = shell(
    `
    <section class="card">
      <p class="eyebrow">Step 2 of 3</p>
      <h1>Which seat?</h1>
      <p class="lead">Optional, but helps the room talk about the right gear. Host only sees anonymous group averages.</p>
      <div class="seat-chips" id="seats">
        ${MANAGER_SEATS.map(
          (s) =>
            `<button type="button" class="chip" data-seat="${s.id}">${escapeHtml(s.label)}</button>`
        ).join("")}
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" id="btn-seat-back">Back</button>
        <div style="display:flex;gap:0.5rem">
          <button type="button" class="btn btn-ghost" id="btn-skip-seat">Skip</button>
          <button type="button" class="btn btn-primary" id="btn-seat-next" disabled>Continue</button>
        </div>
      </div>
    </section>
  `,
    { sessionId: sid, mode: "Participant" }
  );

  let pick = null;
  $("#seats").onclick = (e) => {
    const btn = e.target.closest("[data-seat]");
    if (!btn) return;
    pick = btn.dataset.seat;
    $$(".chip").forEach((el) => el.classList.toggle("selected", el.dataset.seat === pick));
    $("#btn-seat-next").disabled = !pick;
  };
  $("#btn-seat-back").onclick = () => {
    state.role = null;
    state.seat = null;
    render();
  };
  $("#btn-skip-seat").onclick = () => {
    state.seat = "other";
    state.page = 0;
    render();
  };
  $("#btn-seat-next").onclick = () => {
    state.seat = pick;
    state.page = 0;
    render();
  };
  wireNav();
}

function renderQuestions(sid) {
  const totalPages = Math.ceil(QUESTIONS.length / PAGE_SIZE);
  const start = state.page * PAGE_SIZE;
  const slice = QUESTIONS.slice(start, start + PAGE_SIZE);
  const answeredOnPage = slice.every((q) => state.answers[q.id] !== undefined);
  const progress = Math.round(
    (Object.keys(state.answers).length / QUESTIONS.length) * 100
  );

  app().innerHTML = shell(
    `
    <section class="card">
      <div class="progress-wrap">
        <div class="progress-bar"><i style="width:${progress}%"></i></div>
        <div class="progress-meta">
          <span>Page ${state.page + 1} of ${totalPages}</span>
          <span>${Object.keys(state.answers).length} / ${QUESTIONS.length} answered</span>
        </div>
      </div>
      <p class="eyebrow">Practice questions</p>
      <h1>Answer from this week</h1>
      <p class="lead">Honest answers help more than perfect ones. Not sure is fine.</p>
      <div id="q-list">
        ${slice
          .map((q) => {
            const sel = state.answers[q.id];
            return `
            <div class="q-block" data-qid="${q.id}">
              <p class="q-gear">${escapeHtml(q.gearName)}</p>
              <p class="q-text">${escapeHtml(q.text)}</p>
              <div class="scale">
                ${SCALE.map((opt) => {
                  const valAttr = opt.value === null ? "null" : String(opt.value);
                  const isSel =
                    sel !== undefined &&
                    ((opt.value === null && sel === null) || sel === opt.value);
                  const na = opt.value === null ? " opt-na" : "";
                  return `<button type="button" class="scale-opt${na}${isSel ? " selected" : ""}" data-qid="${q.id}" data-val="${valAttr}">${escapeHtml(opt.label)}</button>`;
                }).join("")}
              </div>
            </div>`;
          })
          .join("")}
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" id="btn-q-back">${state.page === 0 ? "Back" : "Previous"}</button>
        <button type="button" class="btn btn-primary" id="btn-q-next" ${answeredOnPage ? "" : "disabled"}>
          ${state.page + 1 >= totalPages ? "See my results" : "Continue"}
        </button>
      </div>
    </section>
  `,
    { sessionId: sid, mode: "Participant" }
  );

  $("#q-list").onclick = (e) => {
    const btn = e.target.closest(".scale-opt");
    if (!btn) return;
    const qid = btn.dataset.qid;
    const raw = btn.dataset.val;
    state.answers[qid] = raw === "null" ? null : Number(raw);
    render();
  };

  $("#btn-q-back").onclick = () => {
    if (state.page === 0) {
      if (state.role === "manager") {
        state.seat = null;
      } else {
        state.role = null;
      }
      render();
      return;
    }
    state.page -= 1;
    render();
  };

  $("#btn-q-next").onclick = async () => {
    if (!answeredOnPage) return;
    if (state.page + 1 < totalPages) {
      state.page += 1;
      render();
      return;
    }
    await finishParticipant(sid);
  };
  wireNav();
}

async function finishParticipant(sid) {
  const scored = scoreAll(state.answers);
  state.result = scored;
  try {
    await submitResponse(sid, {
      role: state.role,
      seat: state.seat,
      answers: state.answers,
      byGear: scored.byGear,
      overall: scored.overall,
    });
    toast("Saved to session");
  } catch (e) {
    console.error(e);
    toast("Saved on this device");
  }
  render();
}

function renderPrivateResults(sid) {
  const r = state.result;
  const overall = r.overall;
  app().innerHTML = shell(
    `
    <section class="card">
      <p class="eyebrow">Your private results</p>
      <h1>Your Reality Check</h1>
      <div class="score-hero">
        <div class="score-num">${overall ?? "—"}</div>
        <div class="score-band">${bandLabel(overall)}</div>
        <p class="muted" style="margin-top:0.75rem">Only you see this breakdown. The host sees anonymous group averages.</p>
      </div>
      <ul class="gear-list">
        ${GEARS.map((g) => {
          const v = r.byGear[g.id];
          const w = v === null || v === undefined ? 0 : v;
          return `
            <li>
              <span class="name">${escapeHtml(g.name)}</span>
              <span class="val">${v ?? "—"}</span>
              <div class="bar-wrap"><i style="width:${w}%"></i></div>
            </li>`;
        }).join("")}
      </ul>
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" data-nav="/">Done</button>
        <button type="button" class="btn btn-primary" id="btn-again">Retake</button>
      </div>
    </section>
  `,
    { sessionId: sid, mode: "Participant" }
  );
  $("#btn-again").onclick = () => {
    state.role = null;
    state.seat = null;
    state.answers = {};
    state.page = 0;
    state.result = null;
    render();
  };
  wireNav();
}

/* —— Host —— */
async function renderHost() {
  const sid = state.route.sessionId;

  if (!isHostAuthed(sid)) {
    app().innerHTML = shell(
      `
      <section class="card">
        <p class="eyebrow">Host access</p>
        <h1>Host dashboard</h1>
        <p class="lead">Enter the host key for session <strong>${escapeHtml(sid)}</strong>.</p>
        <div class="field">
          <label for="host-key">Host key</label>
          <input id="host-key" type="password" placeholder="Host key" autocomplete="current-password" />
        </div>
        <div id="host-err" class="error hidden"></div>
        <div class="btn-row">
          <button type="button" class="btn btn-secondary" data-nav="/">Back</button>
          <button type="button" class="btn btn-primary" id="btn-host-login">Enter</button>
        </div>
      </section>
    `,
      { sessionId: sid, mode: "Host", wide: true }
    );
    const tryLogin = () => {
      const key = ($("#host-key").value || "").trim();
      if (key !== HOST_KEY) {
        const err = $("#host-err");
        err.textContent = "Incorrect host key.";
        err.classList.remove("hidden");
        return;
      }
      setHostAuthed(sid, true);
      render();
    };
    $("#btn-host-login").onclick = tryLogin;
    $("#host-key").addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryLogin();
    });
    wireNav();
    return;
  }

  let session;
  try {
    session = await getSession(sid);
  } catch {
    session = { id: sid, responses: [] };
  }

  // Seed demo samples only for TEST-001 when empty (local demo)
  if (sid === demoSessionId() && (!session.responses || !session.responses.length)) {
    session = seedDemoIfEmpty(sid);
  }

  const agg = aggregate(session);
  state.hostSession = session;
  state.hostAgg = agg;

  const origin = location.origin;
  const joinUrl = `${origin}/benchmarking-event/${encodeURIComponent(sid)}`;
  const gearName = (id) => GEARS.find((g) => g.id === id)?.name || id;
  const strongest = (agg.strongest || []).map((g) => ({
    ...g,
    name: gearName(g.id),
  }));
  const weakest = (agg.weakest || []).map((g) => ({
    ...g,
    name: gearName(g.id),
  }));
  const strongIds = new Set(strongest.map((g) => g.id));
  const weakIds = new Set(weakest.map((g) => g.id));
  // Also mark any gear tied with the top/bottom score so "actual" ties show correctly
  if (strongest[0]) {
    GEARS.forEach((g) => {
      if (agg.byGear[g.id] === strongest[0].score) strongIds.add(g.id);
    });
  }
  if (weakest[0]) {
    GEARS.forEach((g) => {
      if (agg.byGear[g.id] === weakest[0].score) weakIds.add(g.id);
    });
  }
  // If a gear is both (all equal), prefer neutral; rare
  const band = bandLabel(agg.overall);

  const gearRows = GEARS.map((g) => {
    const score = agg.byGear[g.id];
    const hasScore = score !== null && score !== undefined;
    let rowClass = "gear-score-row";
    let badge = "";
    let barClass = "group";
    if (hasScore && weakIds.has(g.id) && !strongIds.has(g.id)) {
      rowClass += " is-weak";
      badge = `<span class="gear-badge badge-weak">Lowest</span>`;
      barClass = "weak";
    } else if (hasScore && strongIds.has(g.id) && !weakIds.has(g.id)) {
      rowClass += " is-strong";
      badge = `<span class="gear-badge badge-strong">Strongest</span>`;
      barClass = "strong";
    } else if (hasScore && strongIds.has(g.id) && weakIds.has(g.id)) {
      badge = `<span class="gear-badge badge-mid">Tied</span>`;
    }
    return `
      <div class="${rowClass}">
        <div class="gear-score-meta">
          <div class="gear-score-name">
            ${escapeHtml(g.name)}
            ${badge}
          </div>
          <div class="gear-score-num" aria-label="Average score">${hasScore ? score : "—"}</div>
        </div>
        <div class="bar-track gear-score-track">
          ${
            hasScore
              ? `<div class="bar-fill ${barClass}" style="width:${score}%"></div>`
              : `<div class="bar-fill empty">—</div>`
          }
        </div>
        <div class="gear-score-sub muted">Group average · ${hasScore ? `${score} / 100` : "no scores yet"}</div>
      </div>`;
  }).join("");

  app().innerHTML = shell(
    `
    <section class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap">
        <div>
          <p class="eyebrow">Live host view</p>
          <h1>Session ${escapeHtml(sid)}</h1>
          <p class="lead" style="margin-bottom:0">Anonymous group scores by section. No names on the board.</p>
        </div>
        <div class="live-dot">Live · refreshes</div>
      </div>
      <div class="stats-row" style="margin-top:1.1rem">
        <div class="stat"><div class="n">${agg.completed}</div><div class="l">Completed</div></div>
        <div class="stat"><div class="n">${fmtScore(agg.overall)}</div><div class="l">Overall group avg</div></div>
        <div class="stat owner"><div class="n">${escapeHtml(band)}</div><div class="l">Group band</div></div>
        <div class="stat manager"><div class="n">${agg.completed}</div><div class="l">Responses</div></div>
      </div>
    </section>

    <section class="card chart-card">
      <h2>Strongest and lowest sections</h2>
      ${
        agg.completed
          ? `<div class="highlight-row">
        <div class="highlight strong">
          <div class="tile-label">Strongest (highest average)</div>
          <ul class="highlight-list">
            ${strongest
              .map(
                (g) =>
                  `<li><strong>${escapeHtml(g.name)}</strong> <span class="score-green">${g.score}</span></li>`
              )
              .join("") || "<li class='muted'>Not enough data yet</li>"}
          </ul>
        </div>
        <div class="highlight weak">
          <div class="tile-label">Lowest (lowest average)</div>
          <ul class="highlight-list">
            ${weakest
              .map(
                (g) =>
                  `<li><strong>${escapeHtml(g.name)}</strong> <span class="score-red">${g.score}</span></li>`
              )
              .join("") || "<li class='muted'>Not enough data yet</li>"}
          </ul>
        </div>
      </div>
      ${
        weakest[0]
          ? `<div class="gap-callout callout-weak">Lowest section to discuss first: <strong>${escapeHtml(weakest[0].name)}</strong> — group average <strong class="score-red">${weakest[0].score}</strong> / 100.</div>`
          : ""
      }
      ${
        strongest[0]
          ? `<div class="gap-callout callout-strong">Strongest section: <strong>${escapeHtml(strongest[0].name)}</strong> — group average <strong class="score-green">${strongest[0].score}</strong> / 100.</div>`
          : ""
      }`
          : `<p class="muted">Waiting for the first completed Reality Check…</p>`
      }
    </section>

    <section class="card chart-card">
      <h2>Section averages (everyone who finished)</h2>
      <p class="muted" style="margin:0 0 1rem">Each score is the <strong>group average</strong> for that segment (0–100). <span class="legend-strong">Green = strongest</span> · <span class="legend-weak">Red = lowest</span>.</p>
      <div class="gear-score-list">
        ${gearRows}
      </div>
    </section>

    <section class="card">
      <h2>Participant link</h2>
      <p class="lead">Share this URL or QR it on the screen.</p>
      <div class="qr-hint"><code id="join-url">${escapeHtml(joinUrl)}</code></div>
      <div class="host-actions">
        <button type="button" class="btn btn-primary" id="btn-copy">Copy link</button>
        <button type="button" class="btn btn-secondary" id="btn-open-join">Open participant view</button>
        <button type="button" class="btn btn-secondary" id="btn-refresh">Refresh now</button>
        <button type="button" class="btn btn-danger" id="btn-clear">Clear session data</button>
      </div>
      <p class="muted" style="margin-top:0.85rem">
        API: ${state.apiOk ? "connected (multi-device)" : "local only (same browser / tabs)"}.
        Run <code>python3 server.py</code> for multi-phone rooms.
      </p>
    </section>
  `,
    { sessionId: sid, mode: "Host", wide: true }
  );

  $("#btn-copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast("Link copied");
    } catch {
      toast("Copy failed — select the URL");
    }
  };
  $("#btn-open-join").onclick = () => window.open(joinUrl, "_blank");
  $("#btn-refresh").onclick = () => render();
  $("#btn-clear").onclick = async () => {
    if (!confirm(`Clear all responses for ${sid}?`)) return;
    await clearSession(sid);
    toast("Session cleared");
    render();
  };

  if (!state.pollTimer) {
    state.pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") renderHostQuiet(sid);
    }, 4000);
  }

  wireNav();
}

async function renderHostQuiet(sid) {
  try {
    const session = await getSession(sid);
    const agg = aggregate(session);
    const prev = state.hostAgg;
    if (
      prev &&
      prev.completed === agg.completed &&
      prev.overall === agg.overall &&
      JSON.stringify(prev.byGear) === JSON.stringify(agg.byGear)
    ) {
      return;
    }
    state.hostSession = session;
    state.hostAgg = agg;
    const root = app();
    if (!root || !isHostAuthed(sid)) return;
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    await renderHost();
  } catch {
    /* ignore poll errors */
  }
}

function barFill(cls, val) {
  if (val === null || val === undefined) {
    return `<div class="bar-track"><div class="bar-fill empty">—</div></div>`;
  }
  return `<div class="bar-track"><div class="bar-fill ${cls}" style="width:${val}%">${val}</div></div>`;
}

function fmtScore(v) {
  return v === null || v === undefined ? "—" : String(v);
}

function wireNav() {
  $$("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(el.getAttribute("data-nav") || el.getAttribute("href"));
    });
  });
}

function render() {
  const r = state.route;
  if (r.name === "home") renderHome();
  else if (r.name === "event") renderEvent();
  else if (r.name === "host") renderHost();
  else renderHome();
}

async function init() {
  state.apiOk = await checkApi();
  window.addEventListener("popstate", onRoute);
  window.addEventListener("soe-rc-update", () => {
    if (state.route.name === "host" && isHostAuthed(state.route.sessionId)) {
      renderHost();
    }
  });
  onRoute();
}

init();
