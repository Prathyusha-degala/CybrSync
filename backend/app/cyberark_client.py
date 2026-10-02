"""Minimal async client for the CyberArk PVWA REST API (v10+ "API" endpoints).

Only the calls CybrSync needs are implemented:
  * POST /API/auth/{method}/Logon, POST /API/auth/Logoff
  * GET  /API/Accounts (paged inventory crawl), GET /API/Accounts/{id}
  * POST /API/Accounts (bulk onboarding)

The client never calls /Verify, /Change, /Reconcile or any password-retrieval
endpoint: CPM actions are *simulated* by app.simulator.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

import httpx

from .config import outbound_ssl_context, settings


class PVWAError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def normalize_base(url: str) -> str:
    base = url.rstrip("/")
    if not base.lower().endswith("/passwordvault"):
        base += "/PasswordVault"
    return base


def check_host_allowed(url: str) -> None:
    host = (urlparse(url).hostname or "").lower()
    if settings.pvwa_host_allowlist and host not in settings.pvwa_host_allowlist:
        raise PVWAError(403, f"PVWA host '{host}' is not in CYBRSYNC_PVWA_HOST_ALLOWLIST")


def _error_message(resp: httpx.Response) -> str:
    try:
        body = resp.json()
        if isinstance(body, dict):
            return body.get("ErrorMessage") or body.get("Details") or resp.reason_phrase
    except ValueError:
        pass
    return resp.reason_phrase or f"HTTP {resp.status_code}"


class PVWAClient:
    def __init__(self, pvwa_url: str):
        check_host_allowed(pvwa_url)
        self.base = normalize_base(pvwa_url)
        self.host = urlparse(self.base).hostname or ""
        self._token: str | None = None
        self._http = httpx.AsyncClient(
            base_url=self.base,
            verify=outbound_ssl_context(),
            timeout=httpx.Timeout(30.0, connect=10.0),
            follow_redirects=False,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        headers = kwargs.pop("headers", {})
        if self._token:
            headers["Authorization"] = self._token
        try:
            resp = await self._http.request(method, path, headers=headers, **kwargs)
        except httpx.HTTPError as exc:
            raise PVWAError(502, f"PVWA unreachable: {type(exc).__name__}") from None
        if resp.status_code >= 400:
            raise PVWAError(resp.status_code, _error_message(resp))
        return resp

    async def logon(self, username: str, password: str, method: str = "CyberArk") -> None:
        resp = await self._request(
            "POST",
            f"/API/auth/{method}/Logon",
            json={"username": username, "password": password, "concurrentSession": True},
        )
        token = resp.json()
        if not isinstance(token, str) or not token:
            raise PVWAError(502, "Unexpected logon response from PVWA")
        self._token = token

    async def logoff(self) -> None:
        if self._token:
            try:
                await self._request("POST", "/API/auth/Logoff")
            except PVWAError:
                pass
            self._token = None

    async def iter_accounts(self, page_size: int = 1000, cap: int = 100_000) -> list[dict]:
        out: list[dict] = []
        offset = 0
        while offset < cap:
            resp = await self._request("GET", "/API/Accounts", params={"limit": page_size, "offset": offset})
            body = resp.json()
            page = body.get("value", [])
            out.extend(page)
            offset += len(page)
            if not page or offset >= int(body.get("count", 0)):
                break
        return out

    async def get_account(self, account_id: str) -> dict:
        return (await self._request("GET", f"/API/Accounts/{account_id}")).json()

    async def add_account(self, body: dict) -> dict:
        return (await self._request("POST", "/API/Accounts", json=body)).json()

    async def aclose(self) -> None:
        await self.logoff()
        await self._http.aclose()


def os_from_platform(platform_id: str | None) -> str:
    p = (platform_id or "").lower()
    if any(k in p for k in ("unix", "linux", "ssh", "aix", "solaris")):
        return "Unix"
    if "windomain" in p or "domain" in p:
        return "Windows Domain"
    if "win" in p:
        return "Windows"
    return platform_id or "Unknown"
