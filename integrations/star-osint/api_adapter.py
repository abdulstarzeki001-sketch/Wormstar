"""Optional read-only FastAPI adapter for a local STAR CYBER LAB backend.

Never expose collectors through HTTP. The owning FastAPI app must supply an
authentication dependency that rejects unauthorized requests with HTTP 401/403.
"""


def create_router(report_directory, owner_auth_dependency):
    if not callable(owner_auth_dependency):
        raise ValueError("owner authentication dependency is required")
    from pathlib import Path
    from fastapi import APIRouter, Depends, HTTPException

    report_dir = Path(report_directory).expanduser().resolve()
    router = APIRouter(prefix="/api/v1/osint", tags=["OSINT"],
                       dependencies=[Depends(owner_auth_dependency)])

    @router.get("/report")
    def get_report():
        path = report_dir / "report.json"
        if not path.is_file() or path.is_symlink() or path.stat().st_size > 2_000_000:
            raise HTTPException(status_code=404, detail="OSINT report unavailable")
        import json
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            raise HTTPException(status_code=503, detail="Invalid OSINT report")
        if data.get("schema") != "star-osint-report/v1":
            raise HTTPException(status_code=503, detail="Unsupported OSINT report")
        return data

    @router.get("/infrastructure")
    def get_infrastructure():
        path = report_dir / "infrastructure.json"
        if not path.is_file() or path.is_symlink() or path.stat().st_size > 2_000_000:
            raise HTTPException(status_code=404, detail="Infrastructure report unavailable")
        import json
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            raise HTTPException(status_code=503, detail="Invalid infrastructure report")
        if data.get("schema") != "star-osint-infrastructure/v1":
            raise HTTPException(status_code=503, detail="Unsupported infrastructure report")
        return data

    return router
