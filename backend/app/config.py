"""Runtime configuration, sourced exclusively from environment variables.

Nothing here is ever written to disk; secrets are never read from config.
"""
from __future__ import annotations

import os
import ssl
from dataclasses import dataclass, field


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _list(name: str) -> list[str]:
    return [v.strip() for v in os.getenv(name, "").split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    # Browser origins allowed to call the API (the Vite dev server by default).
    cors_origins: list[str] = field(
        default_factory=lambda: _list("CYBRSYNC_CORS_ORIGINS") or ["http://localhost:5173", "https://localhost:5173"]
    )
    # Mark session cookies Secure. Enable whenever the UI is served over HTTPS.
    secure_cookies: bool = field(default_factory=lambda: _bool("CYBRSYNC_SECURE_COOKIES", False))
    # Idle timeout for in-memory PVWA sessions.
    session_idle_seconds: int = field(default_factory=lambda: int(os.getenv("CYBRSYNC_SESSION_IDLE_SECONDS", "900")))
    # Minimum TLS version for outbound PVWA / LDAPS connections: "1.3" (default) or "1.2".
    pvwa_min_tls: str = field(default_factory=lambda: os.getenv("CYBRSYNC_PVWA_MIN_TLS", "1.3"))
    # Optional custom CA bundle for PVWA/LDAPS (internal PKI). Certificate verification can never be disabled.
    pvwa_ca_bundle: str | None = field(default_factory=lambda: os.getenv("CYBRSYNC_PVWA_CA_BUNDLE") or None)
    # Optional allowlist of PVWA hostnames (SSRF guard). Empty = any https host.
    pvwa_host_allowlist: list[str] = field(
        default_factory=lambda: [h.lower() for h in _list("CYBRSYNC_PVWA_HOST_ALLOWLIST")]
    )
    # Discovery limits.
    probe_max_hosts: int = field(default_factory=lambda: int(os.getenv("CYBRSYNC_PROBE_MAX_HOSTS", "1024")))
    probe_concurrency: int = field(default_factory=lambda: int(os.getenv("CYBRSYNC_PROBE_CONCURRENCY", "64")))
    probe_timeout: float = field(default_factory=lambda: float(os.getenv("CYBRSYNC_PROBE_TIMEOUT", "1.5")))


settings = Settings()


def outbound_ssl_context() -> ssl.SSLContext:
    """Strict client TLS context: verification always on, TLS 1.3 by default."""
    ctx = ssl.create_default_context(cafile=settings.pvwa_ca_bundle)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_3 if settings.pvwa_min_tls == "1.3" else ssl.TLSVersion.TLSv1_2
    ctx.check_hostname = True
    ctx.verify_mode = ssl.CERT_REQUIRED
    return ctx
