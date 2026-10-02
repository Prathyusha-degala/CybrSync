"""Data providers behind the shared workspace engine.

``SandboxProvider`` serves the mock dataset; ``LiveProvider`` talks to a real
PVWA and the network. Both expose the same interface so the Admin Sandbox
exercises exactly the same scan/policy/onboard/simulate code paths as live mode.
"""
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod

from . import discovery, mock_data
from .cyberark_client import PVWAClient, PVWAError, os_from_platform
from .models import Account, DiscoveryRequest
from .simulator import SimContext


class Provider(ABC):
    kind: str

    @abstractmethod
    async def scan(self, req: DiscoveryRequest) -> tuple[list[Account], list[Account]]:
        """Return (discovered outside the vault, inventory inside the vault)."""

    @abstractmethod
    async def onboard_one(self, account: Account, safe: str, platform: str) -> dict:
        """Create the account in the vault. Returns {'ok', 'message', 'vaultId'}."""

    @abstractmethod
    async def sim_context(self, account: Account, action: str) -> SimContext: ...

    async def close(self) -> None:
        return None


class SandboxProvider(Provider):
    kind = "sandbox"

    def __init__(self) -> None:
        self._accounts, self._outcomes, self._onboard_errors = mock_data.build()
        self._next_vault_id = 900

    async def scan(self, req: DiscoveryRequest) -> tuple[list[Account], list[Account]]:
        await asyncio.sleep(0.6)  # make the async crawl feel real in the UI
        return [a for a in self._accounts if not a.inVault], [a for a in self._accounts if a.inVault]

    async def onboard_one(self, account: Account, safe: str, platform: str) -> dict:
        await asyncio.sleep(0.15)
        if err := self._onboard_errors.get(account.id):
            return {"ok": False, "message": f"POST /API/Accounts -> 409: {err}"}
        self._next_vault_id += 1
        return {"ok": True, "message": "POST /API/Accounts -> 201 Created (mock)", "vaultId": f"12_{self._next_vault_id}"}

    async def sim_context(self, account: Account, action: str) -> SimContext:
        outcome = self._outcomes.get(account.id, "success")
        details = {
            "platformId": account.platformId,
            "safeName": account.safeName,
            "secretManagement": {"automaticManagementEnabled": account.automaticManagement is not False},
        }
        return SimContext(account, action, details, reachable=account.reachable, forced_outcome=outcome)  # type: ignore[arg-type]


def vault_to_account(raw: dict) -> Account:
    sm = raw.get("secretManagement") or {}
    return Account(
        id=f"v:{raw['id']}",
        userName=raw.get("userName") or raw.get("name") or "",
        address=raw.get("address") or "",
        osType=os_from_platform(raw.get("platformId")),
        source="vault",
        inVault=True,
        vaultId=raw["id"],
        safeName=raw.get("safeName"),
        platformId=raw.get("platformId"),
        automaticManagement=sm.get("automaticManagementEnabled"),
        state="Managed",
    )


class LiveProvider(Provider):
    kind = "live"

    def __init__(self, client: PVWAClient) -> None:
        self.client = client

    async def scan(self, req: DiscoveryRequest) -> tuple[list[Account], list[Account]]:
        async def discovered() -> list[Account]:
            found: list[Account] = discovery.parse_csv(req.csv) if req.csv else []
            if req.ldap:
                found += await discovery.ldap_discover(req.ldap)
            if req.probe and found:
                await discovery.probe_accounts(found)
            return found

        found, raw_vault = await asyncio.gather(discovered(), self.client.iter_accounts())
        return found, [vault_to_account(r) for r in raw_vault if r.get("id")]

    async def onboard_one(self, account: Account, safe: str, platform: str) -> dict:
        body = {
            "address": account.address,
            "userName": account.userName,
            "platformId": platform,
            "safeName": safe,
            "secretType": "password",
            # No secret is supplied: the CPM reconciles it using the platform's reconcile account.
            "secretManagement": {"automaticManagementEnabled": True},
        }
        try:
            created = await self.client.add_account(body)
        except PVWAError as exc:
            return {"ok": False, "message": f"POST /API/Accounts -> {exc.status}: {exc.message}"}
        return {"ok": True, "message": "POST /API/Accounts -> 201 Created", "vaultId": created.get("id")}

    async def sim_context(self, account: Account, action: str) -> SimContext:
        details, (reachable, _) = await asyncio.gather(
            self.client.get_account(account.vaultId or ""), discovery.fingerprint(account.address)
        )
        return SimContext(account, action, details, reachable=reachable)  # type: ignore[arg-type]

    async def close(self) -> None:
        await self.client.aclose()
