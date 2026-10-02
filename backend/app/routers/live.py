"""Live operational workspace: credential-gated, talks to a real PVWA."""
from fastapi import APIRouter, Depends, Request, Response

from .. import workspace
from ..cyberark_client import PVWAClient
from ..models import LogonRequest, OnboardRequest, ScanRequest, SimulateRequest
from ..providers import LiveProvider
from ..sessions import live_sessions, require_csrf_header

router = APIRouter(prefix="/api/live", tags=["live"], dependencies=[Depends(require_csrf_header)])


@router.post("/session")
async def logon(body: LogonRequest, request: Request, response: Response):
    await live_sessions.drop(request, response)  # never stack sessions
    client = PVWAClient(str(body.pvwaUrl))
    try:
        await client.logon(body.username, body.password, body.authMethod)
    except Exception:
        await client.aclose()
        raise
    session = await live_sessions.create(LiveProvider(client), f"{body.username}@{client.host}", response)
    return {"authenticated": True, "user": session.label, "expiresIn": live_sessions.idle}


@router.get("/session")
async def status(request: Request):
    session = await live_sessions.get(request)
    if not session:
        return {"authenticated": False}
    return {"authenticated": True, "user": session.label, "expiresIn": live_sessions.seconds_left(session)}


@router.delete("/session")
async def logoff(request: Request, response: Response):
    await live_sessions.drop(request, response)
    return {"authenticated": False}


@router.post("/scan")
async def scan(body: ScanRequest, request: Request):
    return await workspace.scan(await live_sessions.require(request), body)


@router.post("/onboard")
async def onboard(body: OnboardRequest, request: Request):
    return await workspace.onboard(await live_sessions.require(request), body)


@router.post("/simulate")
async def simulate(body: SimulateRequest, request: Request):
    return workspace.simulate(await live_sessions.require(request), body)
