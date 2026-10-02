"""Shared workspace engine: merge, governance, onboarding and simulation.

Used identically by the sandbox and live routers. The blocklist is re-evaluated
server-side on every action — the client's view is never trusted.
"""
from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from . import simulator
from .blocklist import Policy, compile_policy
from .models import Account, OnboardRequest, ScanRequest, SimulateRequest
from .sessions import Session

ONBOARD_CONCURRENCY = 8


def _key(a: Account) -> tuple[str, str]:
    return a.userName.lower(), a.address.lower()


def merge(discovered: list[Account], vaulted: list[Account]) -> list[Account]:
    """Correlate network reality with vault inventory on (userName, address)."""
    by_key = {_key(v): v for v in vaulted}
    merged: dict[str, Account] = {v.id: v for v in vaulted}
    for d in discovered:
        match = by_key.get(_key(d))
        if match:
            match.reachable = d.reachable if d.reachable is not None else match.reachable
            match.source = f"vault+{d.source}" if "+" not in match.source else match.source
        else:
            merged.setdefault(d.id, d)
    return list(merged.values())


def apply_policy(accounts: list[Account], policy: Policy) -> None:
    for a in accounts:
        a.blockReason = policy.evaluate(a.userName, a.address)
        a.state = "Blocklisted" if a.blockReason else ("Managed" if a.inVault else "Unmanaged")


def policy_payload(policy: Policy) -> dict:
    return {"regex": policy.combined_regex(), "errors": list(policy.errors)}


def summarize(accounts: list[Account]) -> dict:
    return {s: sum(a.state == s for a in accounts) for s in ("Unmanaged", "Managed", "Blocklisted")} | {
        "total": len(accounts)
    }


async def scan(session: Session, req: ScanRequest) -> dict:
    policy = compile_policy(req.exclusions)
    discovered, vaulted = await session.provider.scan(req.discovery)
    accounts = merge(discovered, vaulted)
    apply_policy(accounts, policy)
    session.accounts = {a.id: a for a in accounts}
    return {"accounts": [a.model_dump() for a in accounts], "summary": summarize(accounts), "policy": policy_payload(policy)}


async def onboard(session: Session, req: OnboardRequest) -> dict:
    if not session.accounts:
        raise HTTPException(409, "Run a scan before onboarding")
    policy = compile_policy(req.exclusions)
    results: list[dict] = []
    dropped: list[dict] = []
    todo: list[tuple[Account, str]] = []

    for acc_id in dict.fromkeys(req.ids):  # de-duplicate, keep order
        acc = session.accounts.get(acc_id)
        if not acc:
            dropped.append({"id": acc_id, "reason": "Unknown account id"})
            continue
        if reason := policy.evaluate(acc.userName, acc.address):
            dropped.append({"id": acc_id, "userName": acc.userName, "reason": f"Blocklisted - {reason}"})
            continue
        if acc.inVault:
            dropped.append({"id": acc_id, "userName": acc.userName, "reason": "Already managed in vault"})
            continue
        platform = req.platforms.get(acc.osType)
        if not platform:
            dropped.append({"id": acc_id, "userName": acc.userName, "reason": f"No platform mapped for OS '{acc.osType}'"})
            continue
        todo.append((acc, platform))

    sem = asyncio.Semaphore(ONBOARD_CONCURRENCY)

    async def one(acc: Account, platform: str) -> dict:
        async with sem:
            r = await session.provider.onboard_one(acc, req.safeName, platform)
        if r.get("ok"):
            acc.inVault, acc.vaultId, acc.safeName, acc.platformId = True, r.get("vaultId"), req.safeName, platform
            acc.automaticManagement, acc.state = True, "Managed"
        return {"id": acc.id, "userName": acc.userName, "address": acc.address, "platformId": platform, **r}

    async with session.lock:
        results = list(await asyncio.gather(*(one(a, p) for a, p in todo)))
    return {"results": results, "dropped": dropped, "accounts": [a.model_dump() for a in session.accounts.values()]}


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


def simulate(session: Session, req: SimulateRequest) -> StreamingResponse:
    acc = session.accounts.get(req.id)
    if not acc:
        raise HTTPException(404, "Unknown account id - run a scan first")
    policy = compile_policy(req.exclusions)
    acc.blockReason = policy.evaluate(acc.userName, acc.address)
    if not acc.inVault and not acc.blockReason:
        raise HTTPException(409, "CPM simulation requires a managed (vaulted) account")

    async def stream() -> AsyncIterator[str]:
        try:
            ctx = await session.provider.sim_context(acc, req.action)
            async for event in simulator.run(ctx):
                yield _sse(event)
        except Exception as exc:  # surface provider errors in the terminal instead of breaking the stream
            msg = getattr(exc, "message", None) or type(exc).__name__
            yield _sse({"ts": "", "level": "ERROR", "code": "CSYNC500E", "msg": f"Simulation error: {msg}"})
            yield _sse({"ts": "", "level": "DONE", "code": "CSYNC999E", "msg": "Simulation aborted", "result": "failed"})

    return StreamingResponse(
        stream(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"}
    )
