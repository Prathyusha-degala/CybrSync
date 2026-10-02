"""Launch the CybrSync API.

HTTPS (recommended):  set CYBRSYNC_TLS_CERT and CYBRSYNC_TLS_KEY — the server
then only negotiates TLS 1.3. Without them it binds plain HTTP to 127.0.0.1
for local development behind the Vite proxy.
"""
import os
import ssl

import uvicorn
import uvicorn.config

_create_ssl_context = uvicorn.config.create_ssl_context


def _tls13_only(*args, **kwargs) -> ssl.SSLContext:
    ctx = _create_ssl_context(*args, **kwargs)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_3
    return ctx


uvicorn.config.create_ssl_context = _tls13_only

if __name__ == "__main__":
    cert, key = os.getenv("CYBRSYNC_TLS_CERT"), os.getenv("CYBRSYNC_TLS_KEY")
    host = os.getenv("CYBRSYNC_HOST", "127.0.0.1")
    port = int(os.getenv("CYBRSYNC_PORT", "8000"))
    if not (cert and key):
        print("[CybrSync] WARNING: TLS cert/key not set - serving plain HTTP on", f"{host}:{port}", "(dev only)")
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        ssl_certfile=cert,
        ssl_keyfile=key,
        proxy_headers=False,
        server_header=False,
        access_log=True,
    )
