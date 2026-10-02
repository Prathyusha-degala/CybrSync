"""Deterministic mock dataset for the Admin Sandbox (no credentials, no network)."""
from __future__ import annotations

from .models import Account

# (userName, address, osType, source, inVault, platformId, autoMgmt, sim outcome, onboard error)
_ROWS = [
    # ---- Unmanaged: discovered outside the vault ----
    ("local_admin_ops", "web01.corp.local", "Windows", "network", False, None, None, None, None),
    ("svc_backup", "fs02.corp.local", "Windows", "network", False, None, None, None, "Account already exists in safe (duplicate)"),
    ("deploy", "app-lnx-03.corp.local", "Unix", "network", False, None, None, None, None),
    ("oracle", "db-lnx-01.corp.local", "Unix", "network", False, None, None, None, None),
    ("jenkins", "ci-lnx-02.corp.local", "Unix", "network", False, None, None, None, None),
    ("cio_admin", "exec-ws01.corp.local", "Windows", "network", False, None, None, None, None),
    ("helpdesk_local", "ceo_laptop.corp.local", "Windows", "network", False, None, None, None, None),
    ("svc_sql", "corp.local", "Windows Domain", "ad", False, None, None, None, None),
    ("Administrator", "web01.corp.local", "Windows", "network", False, None, None, None, None),
    ("DR_VaultSync", "dr-vault01.corp.local", "Windows", "network", False, None, None, None, None),
    # ---- Managed: inside the vault ----
    ("svc_iis", "web01.corp.local", "Windows", "vault", True, "WinServerLocal", True, "success", None),
    ("ubuntu", "app-lnx-01.corp.local", "Unix", "vault", True, "UnixSSH", True, "success", None),
    ("backup_ops", "fs01.corp.local", "Windows", "vault", True, "WinServerLocal", True, "success", None),
    ("app_sa", "sql02.corp.local", "Windows", "vault", True, "WinServerLocal", True, "auth_fail", None),
    ("svc_legacy", "nt-legacy01.corp.local", "Windows", "vault", True, "WinServerLocal", True, "unreachable", None),
    ("netadmin", "core-sw01.corp.local", "Unix", "vault", True, "UnixSSH", False, "manual", None),
    ("Master", "vault01.corp.local", "Windows", "vault", True, "WinServerLocal", True, "success", None),
    ("PasswordManager_CPM01", "cpm01.corp.local", "Windows", "vault", True, "WinServerLocal", True, "success", None),
    ("Auditor", "vault01.corp.local", "Windows", "vault", True, "WinServerLocal", True, "success", None),
    ("Batch", "vault01.corp.local", "Windows", "vault", True, "WinServerLocal", True, "success", None),
]


def build() -> tuple[list[Account], dict[str, str], dict[str, str]]:
    """Return (accounts, sim_outcomes by id, onboarding errors by id)."""
    accounts: list[Account] = []
    outcomes: dict[str, str] = {}
    onboard_errors: dict[str, str] = {}
    for i, (user, addr, os_type, source, in_vault, platform, auto, outcome, ob_err) in enumerate(_ROWS, start=1):
        acc_id = f"mock-{i:03d}"
        accounts.append(
            Account(
                id=acc_id,
                userName=user,
                address=addr,
                osType=os_type,
                source=source,
                inVault=in_vault,
                vaultId=f"12_{i}" if in_vault else None,
                safeName="SBX-Servers" if in_vault else None,
                platformId=platform,
                automaticManagement=auto,
                reachable=outcome != "unreachable",
                state="Managed" if in_vault else "Unmanaged",
            )
        )
        if outcome:
            outcomes[acc_id] = outcome
        if ob_err:
            onboard_errors[acc_id] = ob_err
    return accounts, outcomes, onboard_errors
