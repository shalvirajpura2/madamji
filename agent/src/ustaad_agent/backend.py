"""Reports progress, memory and safety alerts to the web app, which owns the database.
Every call is fire-and-forget so a slow network never delays the teacher's voice."""

import asyncio
import logging

import aiohttp

from .config import settings

logger = logging.getLogger("ustaad.backend")

_tasks: set[asyncio.Task] = set()


async def _post(event: dict) -> None:
    url = f"{settings.web_url.rstrip('/')}/api/agent/events"
    headers = {"x-agent-secret": settings.agent_secret}
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as http:
            async with http.post(url, json=event, headers=headers) as res:
                if res.status >= 300:
                    logger.warning("backend %s returned %s", event["type"], res.status)
    except Exception as e:  # network trouble must never break the class
        logger.warning("backend %s failed: %s", event["type"], e)


def send(event: dict) -> None:
    task = asyncio.create_task(_post(event))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def flush(timeout: float = 5.0) -> None:
    if _tasks:
        await asyncio.wait(list(_tasks), timeout=timeout)
