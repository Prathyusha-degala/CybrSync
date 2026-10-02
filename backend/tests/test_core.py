import json

from fastapi.testclient import TestClient

from app.blocklist import compile_policy
from app.main import app

H = {"X-CybrSync-Request": "1"}


def test_hardcoded_rules():
    p = compile_policy("")
    for name in ("Master", "administrator", "BATCH", "Auditor", "PasswordManager_CPM01", "svc_cpm", "DR_Sync"):
        assert p.evaluate(name), name
    assert p.evaluate("svc_iis") is None
    assert p.evaluate("Administrators") is None  # exact match only


def test_custom_exclusions_match_user_and_address():
    p = compile_policy("cio_admin, ceo_laptop, ^svc_exec_\\d+$")
    assert p.evaluate("cio_admin", "x")
    assert p.evaluate("helpdesk", "ceo_laptop.corp.local")
    assert p.evaluate("svc_exec_42")
    assert p.evaluate("svc_exec_x") is None


def test_invalid_regex_becomes_literal():
    p = compile_policy("bad(")
    assert p.errors
    assert p.evaluate("my_bad(_acct")


def test_sandbox_flow_drops_blocklisted_and_simulates():
    c = TestClient(app)
    assert c.post("/api/sandbox/scan", json={}).status_code == 403  # CSRF header required

    r = c.post("/api/sandbox/scan", json={"exclusions": "cio_admin"}, headers=H).json()
    by_user = {a["userName"]: a for a in r["accounts"]}
    assert by_user["Master"]["state"] == "Blocklisted"
    assert by_user["cio_admin"]["state"] == "Blocklisted"
    assert by_user["deploy"]["state"] == "Unmanaged"

    ids = [by_user[u]["id"] for u in ("deploy", "cio_admin", "Administrator", "svc_backup")]
    ob = c.post("/api/sandbox/onboard", json={"ids": ids, "safeName": "SBX", "exclusions": "cio_admin"}, headers=H).json()
    assert {d["userName"] for d in ob["dropped"]} == {"cio_admin", "Administrator"}
    outcome = {x["userName"]: x["ok"] for x in ob["results"]}
    assert outcome == {"deploy": True, "svc_backup": False}

    with c.stream("POST", "/api/sandbox/simulate", json={"id": by_user["deploy"]["id"], "action": "rotate"}, headers=H) as s:
        events = [json.loads(line[6:]) for line in s.iter_lines() if line.startswith("data: ")]
    assert events[-1]["result"] == "success"

    with c.stream("POST", "/api/sandbox/simulate", json={"id": by_user["Master"]["id"], "action": "verify"}, headers=H) as s:
        events = [json.loads(line[6:]) for line in s.iter_lines() if line.startswith("data: ")]
    assert events[-1]["result"] == "failed"


def test_live_requires_session():
    c = TestClient(app)
    assert c.post("/api/live/scan", json={}, headers=H).status_code == 401
    bad = c.post("/api/live/session", json={"pvwaUrl": "http://pvwa", "username": "a", "password": "b"}, headers=H)
    assert bad.status_code == 422  # https enforced
