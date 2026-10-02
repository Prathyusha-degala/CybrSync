"""Admin Sandbox: same engine as live mode, backed by mock data. No credentials."""
from fastapi import APIRouter, Depends, Request, Response

from .. import workspace
from ..models import OnboardRequest, ScanRequest, SimulateRequest
from ..providers import SandboxProvider
from ..sessions import require_csrf_header, sandbox_sessions

router = APIRouter(prefix="/api/sandbox", tags=["sandbox"], dependencies=[Depends(require_csrf_header)])


@router.post("/scan")
async def scan(body: ScanRequest, request: Request, response: Response):
    session = await sandbox_sessions.get(request) or await sandbox_sessions.create(SandboxProvider(), "sandbox", response)
    return await workspace.scan(session, body)


@router.post("/onboard")
async def onboard(body: OnboardRequest, request: Request):
    return await workspace.onboard(await sandbox_sessions.require(request), body)


@router.post("/simulate")
async def simulate(body: SimulateRequest, request: Request):
    return workspace.simulate(await sandbox_sessions.require(request), body)


@router.post("/reset")
async def reset(request: Request, response: Response):
    await sandbox_sessions.drop(request, response)
    return {"reset": True}
