from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .blocklist import compile_policy, hardcoded_rules
from .config import settings
from .cyberark_client import PVWAError
from .models import PolicyRequest
from .routers import live, sandbox
from .sessions import live_sessions, sandbox_sessions
from .workspace import policy_payload


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    # Zero persistence: log off every PVWA session and wipe state on shutdown.
    await live_sessions.close_all()
    await sandbox_sessions.close_all()


app = FastAPI(title="CybrSync API", version="1.0.0", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "X-CybrSync-Request"],
)

API_CSP = "default-src 'none'; frame-ancestors 'none'"
UI_CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
    "connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    is_api = request.url.path.startswith("/api") and not request.url.path.startswith("/api/docs")
    h = response.headers
    h.setdefault("Content-Security-Policy", API_CSP if is_api else UI_CSP)
    h["X-Content-Type-Options"] = "nosniff"
    h["X-Frame-Options"] = "DENY"
    h["Referrer-Policy"] = "no-referrer"
    h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    h["Cross-Origin-Opener-Policy"] = "same-origin"
    if is_api:
        h["Cache-Control"] = "no-store"
    if request.url.scheme == "https":
        h["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


@app.exception_handler(PVWAError)
async def pvwa_error(_: Request, exc: PVWAError):
    status = exc.status if exc.status in (401, 403, 404, 409) else 502
    return JSONResponse({"detail": f"PVWA: {exc.message}"}, status_code=status)


@app.get("/api/health")
async def health():
    return {"status": "ok", "persistence": "none", "outboundMinTls": settings.pvwa_min_tls}


@app.get("/api/policy/hardcoded")
async def policy_hardcoded():
    return hardcoded_rules()


@app.post("/api/policy/compile")
async def policy_compile(body: PolicyRequest):
    return policy_payload(compile_policy(body.exclusions))


app.include_router(sandbox.router)
app.include_router(live.router)

# In production, serve the built React app from the same origin (no CORS needed).
_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="ui")
