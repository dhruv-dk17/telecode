"""
server_client.py — HTTP client for the NestJS orchestration server.
Used by the worker to update task status after AI processing.
"""

import httpx
from config import settings


_BASE = settings.server_url.rstrip("/")


async def update_task(
    task_id: str,
    user_id: str,
    status: str,
    result: str | None = None,
    branch_name: str | None = None,
    pr_url: str | None = None,
) -> dict:
    """PATCH task status back to the NestJS server."""
    payload = {
        "userId": user_id,
        "status": status,
    }
    if result is not None:
        payload["result"] = result
    if branch_name is not None:
        payload["branchName"] = branch_name
    if pr_url is not None:
        payload["prUrl"] = pr_url

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{_BASE}/bot/tasks/{task_id}/update",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


async def mark_in_progress(task_id: str, user_id: str) -> dict:
    return await update_task(task_id, user_id, status="IN_PROGRESS")


async def mark_completed(
    task_id: str,
    user_id: str,
    result: str,
    branch_name: str | None = None,
    pr_url: str | None = None,
) -> dict:
    return await update_task(
        task_id, user_id,
        status="COMPLETED",
        result=result,
        branch_name=branch_name,
        pr_url=pr_url,
    )


async def mark_failed(task_id: str, user_id: str, error: str) -> dict:
    return await update_task(
        task_id, user_id,
        status="FAILED",
        result=f"❌ Error: {error}",
    )
