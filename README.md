# SOE Business Machine Reality Check

Live group diagnostic for School of Entrepreneurship sessions.

Participants enter a **Session ID** + **Role**, complete condensed Business Machine practice questions, and see **private** results.  
The host sees **anonymous Owner vs Manager averages** and gear charts in real time.

## Live (Fly.io)

| Surface | URL |
|--------|-----|
| Home | https://soe-reality-check.fly.dev/ |
| Participant | https://soe-reality-check.fly.dev/benchmarking-event/TEST-001 |
| Host | https://soe-reality-check.fly.dev/host/TEST-001 |
| Host key | `soe-host-2026` |

```bash
fly deploy
```

Session data persists on a Fly volume (`/data/sessions.json`).

## Local quick start

```bash
cd soe-reality-check
python3 server.py
```

| Surface | URL |
|--------|-----|
| Join home | http://localhost:8080/ |
| Participant | http://localhost:8080/benchmarking-event/TEST-001 |
| Host | http://localhost:8080/host/TEST-001 |
| Host key | `soe-host-2026` |

`server.py` serves the SPA (path routing) and a small JSON API so multiple phones can share one session.

## What is included

- Path routing: `/benchmarking-event/:id`, `/host/:id`
- Role: Owner or Manager (+ optional manager seat tag)
- 8 gears × 2 practice questions (condensed from the Owner Audit instrument)
- Scale: Yes · Sometimes · Not yet / Not really · Not sure
- Private participant score + per-gear bars
- Host dashboard: counts, Owner/Manager averages, gap callout, live refresh
- Host key gate (`soe-host-2026`)
- Session store: `data/sessions.json` (API) with localStorage fallback

## Project layout

```
soe-reality-check/
  index.html
  server.py
  css/app.css
  js/
    app.js      # SPA UI + router
    data.js     # questions, scoring
    store.js    # API + localStorage
  data/
    sessions.json   # created at runtime
```

## Demo notes

- Session `TEST-001` seeds sample Owner/Manager scores when empty (local demo only).
- Use **Clear session data** on the host view before a real room.
- For multi-device rooms, always run `python3 server.py` (not plain `http.server`).
- Phones on the same Wi‑Fi can use `http://<your-mac-ip>:8080/benchmarking-event/YOUR-ID`.

## Brand

SOE tokens: orange `#F26522`, navy/header `#2c3e50` / `#1B3A5C`, light gray page wash.  
UI pattern aligned with SOE Audit (scale labels, Continue / Back, short copy).

## License

Private — School of Entrepreneurship / The Real Deal Network.
