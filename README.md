# CybrSync — CyberArk Unified Scanner & CPM Simulator

CybrSync is a single-page React/Tailwind app with an async FastAPI backend. It correlates **network reality** (accounts discovered outside the vault) with **Vault inventory** (accounts inside the vault). It enforces a dual-layer governance blocklist, bulk-onboards compliant accounts, and **simulates** CPM verify/rotate cycles without touching target systems.

| View | Route | Purpose |
|---|---|---|
| Enterprise landing page | `/` | Hero, "How It Works" architecture diagram, 3-step cycle, "Why It Is Secure" hub |
| **CyberArk Scan** (live) | `/#/scan` | Credential-gated workspace against a real PVWA |
| **Testing for Admins** (sandbox) | `/#/sandbox` | Same engine on mock data. No credentials needed. |

## Repository layout

```
backend/
  app/
    main.py             FastAPI app, security headers, CORS, static UI hosting
    config.py           Env-driven settings + strict outbound TLS 1.3 context
    blocklist.py        Dual-layer policy engine (authoritative, ReDoS-safe)
    models.py           Pydantic request/response models
    cyberark_client.py  Async PVWA REST client (Logon/Logoff, GET/POST /API/Accounts)
    discovery.py        CSV import, LDAPS AD search, async TCP probe/OS fingerprint
    providers.py        SandboxProvider (mock) and LiveProvider (PVWA), same interface
    workspace.py        Shared engine: merge -> govern -> onboard -> simulate (SSE)
    simulator.py        Dry-run CPM lifecycle event generator (PM.log style)
    sessions.py         In-memory session store, HttpOnly cookies, CSRF header guard
    mock_data.py        Sandbox dataset (includes Master, cio_admin, ceo_laptop ...)
    routers/sandbox.py  /api/sandbox/*
    routers/live.py     /api/live/*
  run.py                Launcher (TLS 1.3-only when a cert/key is supplied)
  tests/test_core.py
frontend/
  src/App.jsx                      Hash router: landing / scan / sandbox
  src/components/Landing.jsx       Landing page sections
  src/components/Workspace.jsx     Shared workspace (filters, onboarding, simulator)
  src/components/BlocklistManager.jsx, AccountTable.jsx, Terminal.jsx
  src/components/LiveScan.jsx      PVWA login gate + discovery panel
  src/components/Sandbox.jsx       Banner + mock workspace
  src/lib/blocklist.js             Client mirror of the policy (live preview only)
  src/lib/api.js                   Fetch + SSE client
samples/discovery.csv              Example discovery import
```

## Run it

Prerequisites: Python 3.11+ and Node 18+.

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
pytest -q
python run.py                   # http://127.0.0.1:8000  (API docs at /api/docs)
```

### 2a. Frontend in dev mode (hot reload)

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173, proxies /api to :8000
```

### 2b. Or a production build served by FastAPI (single origin)

```bash
cd frontend && npm install && npm run build
cd ../backend && python run.py  # serves frontend/dist at http://127.0.0.1:8000
```

### 3. Serve over TLS 1.3 (recommended outside a laptop)

```bash
mkdir certs
openssl req -x509 -newkey rsa:3072 -nodes -days 365 -subj "/CN=localhost" -keyout certs/key.pem -out certs/cert.pem
```

Set these before `python run.py`:

| Variable | Value |
|---|---|
| `CYBRSYNC_TLS_CERT` | `../certs/cert.pem` |
| `CYBRSYNC_TLS_KEY` | `../certs/key.pem` |
| `CYBRSYNC_SECURE_COOKIES` | `true` |

`run.py` then serves TLS 1.3 only. If you use the Vite dev server against an HTTPS backend, set `CYBRSYNC_API=https://127.0.0.1:8000`.

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `CYBRSYNC_PVWA_MIN_TLS` | `1.3` | Minimum TLS version for PVWA/LDAPS (`1.2` only for legacy PVWA) |
| `CYBRSYNC_PVWA_CA_BUNDLE` | *(system)* | CA bundle for internal PKI. Certificate verification cannot be disabled. |
| `CYBRSYNC_PVWA_HOST_ALLOWLIST` | *(any)* | Comma-separated PVWA hostnames allowed (SSRF guard) |
| `CYBRSYNC_SESSION_IDLE_SECONDS` | `900` | Idle expiry for live sessions (followed by PVWA logoff) |
| `CYBRSYNC_SECURE_COOKIES` | `false` | Set `true` when served over HTTPS |
| `CYBRSYNC_CORS_ORIGINS` | `localhost:5173` | Only needed if UI and API are on different origins |
| `CYBRSYNC_PROBE_MAX_HOSTS` / `_CONCURRENCY` / `_TIMEOUT` | `1024` / `64` / `1.5` | Discovery probe limits |

## How the workspace works

1. **Scan & Interrogate.** `POST /api/{mode}/scan` runs discovery and the Vault crawl concurrently.
   - Discovery sources: CSV import, LDAPS paged search, and a TCP connect probe on 22/445/3389/5985 for reachability and OS family.
   - The Vault crawl is paged `GET /API/Accounts`.
   - Accounts are correlated on `(userName, address)` and labelled **Unmanaged**, **Managed** or **Blocklisted**.
2. **Govern & Filter.** The blocklist is applied in two layers:
   - Hardcoded: exact `Master`, `Administrator`, `Batch`, `Auditor`, plus any name containing `PasswordManager`, `CPM` or `DR_`.
   - Enterprise Exclusions: comma-separated strings or regex, matched against both the user name and the address.

   The UI previews the result in real time as you type. The server re-evaluates the policy on every onboard and simulate call, so a blocklisted ID is dropped even if the UI is bypassed. Regex runs with a timeout and fails closed.
3. **Vault & Simulate.**
   - Bulk onboarding sends one `POST /API/Accounts` per eligible unmanaged account. It uses the target safe and the OS→platform mapping, with `automaticManagementEnabled: true` and no secret, so the CPM reconciles it.
   - CPM simulation reads the account metadata (`GET /API/Accounts/{id}`) and makes a TCP reachability check. It then streams PM.log-style events over SSE. It **never** calls Verify, Change or Reconcile, and never retrieves passwords.

## Security model

- **Zero persistence.** There is no database and nothing is written to disk. Passwords are used once for logon. The PVWA token and scan results live in RAM, keyed by the SHA-256 of a random cookie value.
- **Sessions.** The cookie is HttpOnly, SameSite=Strict and scoped to `/api`. Sessions idle-expire and log off from PVWA on expiry, logout or shutdown.
- **CSRF.** Every mutation needs an `X-CybrSync-Request: 1` header. CORS is restricted to an allowlist.
- **TLS.** The inbound server can be set to TLS 1.3 only. Outbound PVWA and LDAPS use TLS 1.3 by default with mandatory certificate and hostname verification. PVWA URLs must be `https://`.
- **Headers.** Every response carries a strict CSP, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, and `Cache-Control: no-store` on the API. HSTS is added over HTTPS.
- **Blast radius.** The only write CybrSync ever makes is `POST /API/Accounts`, and the live UI asks for confirmation first.

> Use a least-privilege PVWA user: *List accounts* and *View account details* on the scanned safes, plus *Add accounts* on the onboarding target safe. For AD, use a read-only bind account.
# CybrSync
CybrSync landing page — an interactive demo platform for testing CyberArk architecture logic and CPM workflow scenarios.
