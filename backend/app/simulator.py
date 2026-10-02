"""Non-disruptive CPM lifecycle simulator.

Produces a PM.log-style event stream describing what the CPM *would* do for a
verify or change (rotation) cycle, driven by real account metadata (live mode)
or pre-baked outcomes (sandbox). It never contacts the target with credentials
and never calls the PVWA Verify/Change/Reconcile endpoints.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import AsyncIterator, Literal

from .models import Account

Outcome = Literal["success", "auth_fail", "unreachable", "manual", "blocked"]


@dataclass
class SimContext:
    account: Account
    action: Literal["verify", "rotate"]
    details: dict
    reachable: bool | None
    forced_outcome: Outcome | None = None  # sandbox pre-baked result
    step_delay: float = 0.35


def _event(level: str, code: str, msg: str, **extra) -> dict:
    return {"ts": datetime.now().strftime("%d/%m/%Y %H:%M:%S"), "level": level, "code": code, "msg": msg, **extra}


async def run(ctx: SimContext) -> AsyncIterator[dict]:
    a = ctx.account
    verb = "Verification" if ctx.action == "verify" else "Change (rotation)"
    pause = lambda: asyncio.sleep(ctx.step_delay)  # noqa: E731
    sm = ctx.details.get("secretManagement", {}) or {}
    platform = ctx.details.get("platformId") or a.platformId or "UnknownPlatform"
    safe = ctx.details.get("safeName") or a.safeName or "UnknownSafe"
    obj = f"{a.userName}@{a.address}"

    yield _event("INFO", "CSYNC100I", f"[DRY-RUN] Starting simulated {verb} for {obj}")
    await pause()
    yield _event("INFO", "CSYNC101I", f"Loaded vault object id={a.vaultId} safe='{safe}' platform='{platform}'")
    await pause()

    if ctx.forced_outcome == "blocked" or a.blockReason:
        yield _event("ERROR", "CSYNC403E", f"Governance blocklist hit - {a.blockReason or 'policy'}. Aborting.")
        yield _event("DONE", "CSYNC999E", "Simulation aborted by policy", result="failed")
        return

    auto = sm.get("automaticManagementEnabled", a.automaticManagement)
    if ctx.forced_outcome == "manual" or auto is False:
        reason = sm.get("manualManagementReason") or "Automatic management disabled"
        yield _event("WARN", "CSYNC210W", f"Account is under manual management: {reason}")
        yield _event("WARN", "CSYNC211W", "Real CPM would skip this account in its scheduled cycle")
        yield _event("DONE", "CSYNC998W", f"{verb} would NOT run (manual management)", result="skipped")
        return
    yield _event("INFO", "CSYNC110I", "Automatic management enabled; CPM policy resolved")
    await pause()

    if sm.get("status") == "failure":
        yield _event("WARN", "CSYNC115W", f"Previous CPM action failed at {sm.get('lastModifiedTime', 'unknown time')}")

    yield _event("INFO", "CSYNC120I", f"Probing {a.address} for plugin transport ({a.osType}) - TCP connect only")
    await pause()
    unreachable = ctx.forced_outcome == "unreachable" or ctx.reachable is False
    if unreachable:
        yield _event("ERROR", "CSYNC420E", f"Target {a.address} unreachable on management ports (timeout)")
        yield _event("ERROR", "CSYNC421E", "Real CPM would record: 'Unable to connect to the remote machine'")
        yield _event("DONE", "CSYNC999E", f"{verb} would FAIL", result="failed")
        return
    yield _event("OK", "CSYNC121I", f"Target {a.address} reachable" + (" (not probed)" if ctx.reachable is None else ""))
    await pause()

    plugin = "UNIX via SSH" if a.osType == "Unix" else "Windows (WMI/RPC)"
    yield _event("INFO", "CSYNC130I", f"Would launch CPM plugin '{plugin}' for action '{ctx.action}' [skipped: dry-run]")
    await pause()

    if ctx.forced_outcome == "auth_fail":
        yield _event("ERROR", "CSYNC430E", "Plugin logon would fail: invalid credentials for current vaulted secret")
        yield _event("WARN", "CSYNC431W", "Recommendation: trigger reconcile with platform reconcile account")
        yield _event("DONE", "CSYNC999E", f"{verb} would FAIL", result="failed")
        return

    if ctx.action == "verify":
        yield _event("OK", "CSYNC140I", "Vaulted secret would be validated against target (simulated match)")
    else:
        yield _event("INFO", "CSYNC150I", "Would generate a password compliant with the platform policy [skipped: dry-run]")
        await pause()
        yield _event("INFO", "CSYNC151I", "Would change password on target [skipped: dry-run]")
        await pause()
        yield _event("INFO", "CSYNC152I", "Would verify new password then update vault object [skipped: dry-run]")
    await pause()
    yield _event("DONE", "CSYNC200I", f"{verb} would SUCCEED for {obj}", result="success")
