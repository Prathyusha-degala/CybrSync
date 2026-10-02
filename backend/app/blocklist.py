"""Dual-layer governance blocklist.

Layer 1 — hardcoded CyberArk safeguards (cannot be changed at runtime):
  * exact (case-insensitive) user names: Master, Administrator, Batch, Auditor
  * user names containing: PasswordManager, CPM, DR_

Layer 2 — custom "Enterprise Exclusions": a comma-separated list of strings or
regular expressions (e.g. ``cio_admin, ceo_laptop, ^svc_exec_.*``) matched
case-insensitively against the account user name *and* its address.

User-supplied patterns are compiled with the ``regex`` module and evaluated with
a hard timeout so a pathological pattern cannot cause ReDoS on the server.
This module is the authoritative enforcement point; the frontend mirrors it only
for live preview.
"""
from __future__ import annotations

from dataclasses import dataclass

import regex

HARDCODED_EXACT: tuple[str, ...] = ("Master", "Administrator", "Batch", "Auditor")
HARDCODED_CONTAINS: tuple[str, ...] = ("PasswordManager", "CPM", "DR_")

MAX_PATTERNS = 50
MAX_PATTERN_LEN = 128
MATCH_TIMEOUT_S = 0.05

_HARD_EXACT = {n.lower() for n in HARDCODED_EXACT}


@dataclass(frozen=True)
class Policy:
    patterns: tuple[tuple[str, "regex.Pattern[str]"], ...]
    errors: tuple[str, ...]

    def evaluate(self, user_name: str, address: str = "") -> str | None:
        """Return a human-readable block reason, or ``None`` if the account is allowed."""
        name = (user_name or "").strip()
        lname = name.lower()
        if lname in _HARD_EXACT:
            return f"Hardcoded safeguard: reserved account '{name}'"
        for token in HARDCODED_CONTAINS:
            if token.lower() in lname:
                return f"Hardcoded safeguard: name contains '{token}'"
        for source, pattern in self.patterns:
            for value in (name, address or ""):
                if not value:
                    continue
                try:
                    if pattern.search(value, timeout=MATCH_TIMEOUT_S):
                        return f"Enterprise exclusion: /{source}/"
                except TimeoutError:
                    # Fail closed: a pattern too expensive to evaluate blocks the account.
                    return f"Enterprise exclusion (evaluation timeout): /{source}/"
        return None

    def combined_regex(self) -> str:
        hard = "^(?:" + "|".join(HARDCODED_EXACT) + ")$|" + "|".join(HARDCODED_CONTAINS)
        custom = "|".join(f"(?:{s})" for s, _ in self.patterns)
        return f"(?i)(?:{hard})" + (f"|{custom}" if custom else "")


def compile_policy(raw: str | None) -> Policy:
    tokens = [t.strip() for t in (raw or "").split(",") if t.strip()]
    errors: list[str] = []
    if len(tokens) > MAX_PATTERNS:
        errors.append(f"Only the first {MAX_PATTERNS} exclusions are applied")
        tokens = tokens[:MAX_PATTERNS]
    compiled: list[tuple[str, regex.Pattern[str]]] = []
    for tok in tokens:
        if len(tok) > MAX_PATTERN_LEN:
            errors.append(f"Pattern longer than {MAX_PATTERN_LEN} chars rejected: {tok[:24]}...")
            continue
        try:
            compiled.append((tok, regex.compile(tok, regex.IGNORECASE)))
        except regex.error as exc:
            # Invalid regex -> apply as a literal string so the operator's intent still holds.
            errors.append(f"Invalid regex '{tok}' ({exc}); applied as a literal string")
            literal = regex.escape(tok)
            compiled.append((literal, regex.compile(literal, regex.IGNORECASE)))
    return Policy(patterns=tuple(compiled), errors=tuple(errors))


def hardcoded_rules() -> dict:
    return {"exact": list(HARDCODED_EXACT), "contains": list(HARDCODED_CONTAINS)}
