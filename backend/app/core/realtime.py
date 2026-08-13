import asyncio
import json
from collections import defaultdict

_loop: asyncio.AbstractEventLoop | None = None
_connections: dict[str, set[asyncio.Queue]] = defaultdict(set)


def set_event_loop(loop: asyncio.AbstractEventLoop | None) -> None:
    """Stash the app's main event loop so sync workers can broadcast safely."""
    global _loop
    _loop = loop


def subscription_keys(*, user_id, is_admin: bool) -> list[str]:
    """The realtime channel groups a given client subscribes to."""
    keys = [f"user:{user_id}"]
    if is_admin:
        keys.append("admin")
    else:
        keys.append("all_users")
    return keys


def broadcast(group: str, event: dict) -> None:
    """Push ``event`` to every client connected to ``group`` (thread-safe)."""
    if _loop is None or group not in _connections:
        return
    queues = list(_connections.get(group, ()))
    if not queues:
        return
    payload = json.dumps(event, default=str)
    for queue in queues:
        try:
            _loop.call_soon_threadsafe(queue.put_nowait, payload)
        except Exception:
            continue


async def subscribe(groups: list[str]) -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    for group in groups:
        _connections[group].add(queue)
    return queue


def unsubscribe(groups: list[str], queue: asyncio.Queue) -> None:
    for group in groups:
        _connections[group].discard(queue)
        if not _connections[group]:
            _connections.pop(group, None)


async def stream(groups: list[str]):
    """SSE generator: emits ``data: <json>`` for each event plus keep-alive comments."""
    queue = await subscribe(groups)
    try:
        yield ": connected"
        while True:
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=15)
                yield f"data: {payload}"
            except asyncio.TimeoutError:
                yield ": keep-alive"
    finally:
        unsubscribe(groups, queue)