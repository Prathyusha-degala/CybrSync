"""Zero-persistence session store.

Sessions (PVWA tokens, scan results, sandbox state) live only in process memory,
are keyed by an opaque random ID delivered in an HttpOnly/SameSite=Strict cookie,
expire after an idle timeout, and are dropped (with PVWA logoff) on expiry,
logout or shutdown. Passwords are never stored — they are used once for logon.
"""
from __future__ import annotations

import asyncio
import hashlib
import secrets
import time
from dataclasses import dataclass, field

from fastapi import HTTPException, Request, Response

from .config import settings
from .models import Account
from .providers import Provider

CSRF_HEADER = "X-CybrSync-Request"


@dataclass
class Session:
    provider: Provider
    label: str
    accounts: dict[str, Account] = field(default_factory=dict)
    last_used: float = field(default_factory=time.monotonic)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


def _key(sid: str) -> str:
    # Store only a hash of the cookie value so a memory dump of the map alone can't be replayed.
    return hashlib.sha256(sid.encode()).hexdigest()


class SessionStore:
    def __init__(self, cookie_name: str, idle_seconds: int):
        self.cookie_name = cookie_name
        self.idle = idle_seconds
        self._sessions: dict[str, Session] = {}
        self._lock = asyncio.Lock()

    async def _purge(self) -> None:
        now = time.monotonic()
        expired = [k for k, s in self._sessions.items() if now - s.last_used > self.idle]
        for k in expired:
            await self._sessions.pop(k).provider.close()

    async def create(self, provider: Provider, label: str, response: Response) -> Session:
        sid = secrets.token_urlsafe(32)
        session = Session(provider=provider, label=label)
        async with self._lock:
            await self._purge()
            self._sessions[_key(sid)] = session
        response.set_cookie(
            self.cookie_name,
            sid,
            httponly=True,
            secure=settings.secure_cookies,
            samesite="strict",
            path="/api",
            max_age=self.idle,
        )
        return session

    async def get(self, request: Request) -> Session | None:
        sid = request.cookies.get(self.cookie_name)
        async with self._lock:
            await self._purge()
            session = self._sessions.get(_key(sid)) if sid else None
        if session:
            session.last_used = time.monotonic()
        return session

    async def require(self, request: Request) -> Session:
        session = await self.get(request)
        if not session:
            raise HTTPException(401, "No active session")
        return session

    async def drop(self, request: Request, response: Response) -> None:
        sid = request.cookies.get(self.cookie_name)
        if sid:
            async with self._lock:
                session = self._sessions.pop(_key(sid), None)
            if session:
                await session.provider.close()
        response.delete_cookie(self.cookie_name, path="/api")

    def seconds_left(self, session: Session) -> int:
        return max(0, int(self.idle - (time.monotonic() - session.last_used)))

    async def close_all(self) -> None:
        async with self._lock:
            for s in self._sessions.values():
                await s.provider.close()
            self._sessions.clear()


sandbox_sessions = SessionStore("cybrsync_sbx", idle_seconds=3600)
live_sessions = SessionStore("cybrsync_live", idle_seconds=settings.session_idle_seconds)


async def require_csrf_header(request: Request) -> None:
    """Custom-header CSRF guard: cross-site forms can't set it and CORS blocks cross-origin XHR."""
    if request.method not in {"GET", "HEAD", "OPTIONS"} and request.headers.get(CSRF_HEADER) != "1":
        raise HTTPException(403, f"Missing {CSRF_HEADER} header")
