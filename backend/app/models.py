from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator

AccountState = Literal["Unmanaged", "Managed", "Blocklisted"]


class Account(BaseModel):
    id: str
    userName: str
    address: str
    osType: str = "Unknown"
    source: str = "network"  # network | ad | vault
    inVault: bool = False
    vaultId: str | None = None
    safeName: str | None = None
    platformId: str | None = None
    automaticManagement: bool | None = None
    reachable: bool | None = None
    state: AccountState = "Unmanaged"
    blockReason: str | None = None


class PolicyRequest(BaseModel):
    exclusions: str = Field(default="", max_length=8000)


class LogonRequest(BaseModel):
    pvwaUrl: HttpUrl
    username: str = Field(min_length=1, max_length=256)
    password: str = Field(min_length=1, max_length=1024, repr=False)
    authMethod: Literal["CyberArk", "LDAP", "RADIUS", "Windows"] = "CyberArk"

    @field_validator("pvwaUrl")
    @classmethod
    def https_only(cls, v: HttpUrl) -> HttpUrl:
        if v.scheme != "https":
            raise ValueError("PVWA URL must use https://")
        return v


class LdapDiscovery(BaseModel):
    server: str = Field(min_length=1, max_length=255)
    bindDn: str = Field(min_length=1, max_length=512)
    password: str = Field(min_length=1, max_length=1024, repr=False)
    baseDn: str = Field(min_length=1, max_length=512)
    searchFilter: str = Field(
        default="(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))",
        max_length=1024,
    )
    sizeLimit: int = Field(default=2000, ge=1, le=10000)


class DiscoveryRequest(BaseModel):
    csv: str | None = Field(default=None, max_length=2_000_000)
    ldap: LdapDiscovery | None = None
    probe: bool = True


class ScanRequest(PolicyRequest):
    discovery: DiscoveryRequest = Field(default_factory=DiscoveryRequest)


class OnboardRequest(PolicyRequest):
    ids: list[str] = Field(min_length=1, max_length=500)
    safeName: str = Field(min_length=1, max_length=28)
    platforms: dict[str, str] = Field(
        default_factory=lambda: {"Windows": "WinServerLocal", "Unix": "UnixSSH", "Windows Domain": "WinDomain"}
    )


class SimulateRequest(PolicyRequest):
    id: str = Field(min_length=1, max_length=128)
    action: Literal["verify", "rotate"]
