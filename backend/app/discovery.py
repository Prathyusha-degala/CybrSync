"""Read-only network discovery ("outside the vault").

Sources:
  * CSV import of local accounts (e.g. an export from a DNA/EPM/host inventory
    scan) with columns ``userName,address[,osType]``.
  * Active Directory via LDAPS — a paged, read-only search of enabled users.
  * Async TCP reachability probe (no authentication, no payload) against
    22/445/3389/5985 to confirm liveness and fingerprint the OS family.

No credentials are ever sent to discovered hosts.
"""
from __future__ import annotations

import asyncio
import csv
import hashlib
import io
import ssl

from .config import settings
from .models import Account, LdapDiscovery

WINDOWS_PORTS = (445, 3389, 5985)
UNIX_PORTS = (22,)
MAX_CSV_ROWS = 50_000


def discovered_id(user: str, address: str) -> str:
    return "d:" + hashlib.sha1(f"{user.lower()}|{address.lower()}".encode()).hexdigest()[:16]


def _pick(row: dict, *names: str) -> str:
    lowered = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
    for n in names:
        if lowered.get(n):
            return lowered[n]
    return ""


def parse_csv(text: str) -> list[Account]:
    out: list[Account] = []
    reader = csv.DictReader(io.StringIO(text.strip()))
    for i, row in enumerate(reader):
        if i >= MAX_CSV_ROWS:
            break
        user = _pick(row, "username", "user", "account", "samaccountname")
        addr = _pick(row, "address", "host", "hostname", "machine", "ip")
        if not user or not addr:
            continue
        os_type = _pick(row, "ostype", "os", "platform") or "Unknown"
        norm = "Unix" if any(k in os_type.lower() for k in ("unix", "linux", "rhel", "ubuntu")) else (
            "Windows" if "win" in os_type.lower() else "Unknown"
        )
        out.append(Account(id=discovered_id(user, addr), userName=user, address=addr, osType=norm, source="network"))
    return out


def _ldap_search(cfg: LdapDiscovery) -> list[Account]:
    from ldap3 import NONE, SUBTREE, Connection, Server, Tls

    options = [ssl.OP_NO_TLSv1, ssl.OP_NO_TLSv1_1]
    if settings.pvwa_min_tls == "1.3":
        options.append(ssl.OP_NO_TLSv1_2)
    tls = Tls(validate=ssl.CERT_REQUIRED, ca_certs_file=settings.pvwa_ca_bundle, ssl_options=options)
    server = Server(cfg.server, port=636, use_ssl=True, tls=tls, get_info=NONE, connect_timeout=10)
    domain = ".".join(p.split("=", 1)[1] for p in cfg.baseDn.split(",") if p.strip().lower().startswith("dc="))
    out: list[Account] = []
    with Connection(server, user=cfg.bindDn, password=cfg.password, auto_bind=True, read_only=True, receive_timeout=30) as conn:
        entries = conn.extend.standard.paged_search(
            search_base=cfg.baseDn,
            search_filter=cfg.searchFilter,
            search_scope=SUBTREE,
            attributes=["sAMAccountName"],
            paged_size=500,
            generator=True,
        )
        for entry in entries:
            if entry.get("type") != "searchResEntry":
                continue
            sam = entry.get("attributes", {}).get("sAMAccountName")
            if isinstance(sam, list):
                sam = sam[0] if sam else None
            if not sam:
                continue
            addr = domain or cfg.server
            out.append(Account(id=discovered_id(sam, addr), userName=sam, address=addr, osType="Windows Domain", source="ad"))
            if len(out) >= cfg.sizeLimit:
                break
    return out


async def ldap_discover(cfg: LdapDiscovery) -> list[Account]:
    # ldap3 is synchronous; run it off the event loop.
    return await asyncio.to_thread(_ldap_search, cfg)


async def tcp_open(host: str, port: int, timeout: float | None = None) -> bool:
    try:
        _, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout or settings.probe_timeout)
    except (OSError, asyncio.TimeoutError):
        return False
    writer.close()
    try:
        await writer.wait_closed()
    except OSError:
        pass
    return True


async def fingerprint(host: str) -> tuple[bool, str | None]:
    """Return (reachable, inferred OS family)."""
    ports = WINDOWS_PORTS + UNIX_PORTS
    results = await asyncio.gather(*(tcp_open(host, p) for p in ports))
    open_ports = {p for p, ok in zip(ports, results) if ok}
    if open_ports & set(WINDOWS_PORTS):
        return True, "Windows"
    if open_ports & set(UNIX_PORTS):
        return True, "Unix"
    return False, None


async def probe_accounts(accounts: list[Account]) -> None:
    hosts = sorted({a.address for a in accounts if a.source == "network"})[: settings.probe_max_hosts]
    sem = asyncio.Semaphore(settings.probe_concurrency)

    async def one(h: str) -> tuple[str, tuple[bool, str | None]]:
        async with sem:
            return h, await fingerprint(h)

    results = dict(await asyncio.gather(*(one(h) for h in hosts)))
    for a in accounts:
        if a.address in results:
            reachable, os_guess = results[a.address]
            a.reachable = reachable
            if a.osType == "Unknown" and os_guess:
                a.osType = os_guess
