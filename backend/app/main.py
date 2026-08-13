import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import includes_api_routes
from app.core.app_exception_handler import app_exception_handler
from app.core.config import settings
from app.core.exceptions import AppException
from app.core.realtime import set_event_loop
import app.models  # noqa: F401 - register all models


@asynccontextmanager
async def lifespan(_: FastAPI):
    set_event_loop(asyncio.get_running_loop())
    yield


app = FastAPI(title="LCH API", version="0.1.0", lifespan=lifespan)

allowed_origins = {
    settings.frontend_url.rstrip("/"),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://leenah-contribution-home-web.vercel.app",
    *[origin.rstrip("/") for origin in settings.cors_allowed_origins],
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

includes_api_routes(app)

app.add_exception_handler(AppException, app_exception_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "An unexpected error occurred.",
            "error_code": "INTERNAL_ERROR",
        },
    )


@app.get("/")
def health():
    return {"status": "ok", "service": "LCH API"}