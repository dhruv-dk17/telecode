"""
telegram_notifier.py — Push AI results back to the user via the Telegram Bot API.

The worker calls this after completing a task so the user gets their answer
directly in the chat — even if they've closed the app.
"""

import httpx
from config import settings


_BOT_BASE = f"https://api.telegram.org/bot{'{token}'}/sendMessage"


async def send_result(
    bot_token: str,
    chat_id: str | int,
    task_mode: str,
    result: str,
    branch_name: str | None = None,
    pr_url: str | None = None,
) -> bool:
    """
    Send the AI result back to the user's Telegram chat.
    Returns True on success.
    """
    mode_emoji = {"EXPLAIN": "🔍", "PLAN": "🗺", "EXECUTE": "⚡"}.get(task_mode, "🤖")
    mode_label = {"EXPLAIN": "Explanation", "PLAN": "Plan", "EXECUTE": "Execution Result"}.get(task_mode, "Result")

    header = f"{mode_emoji} *Telecode — {mode_label}*\n\n"
    footer = ""

    if branch_name:
        footer += f"\n\n🌿 Branch: `{branch_name}`"
    if pr_url:
        footer += f"\n🔗 [View PR]({pr_url})"

    # Telegram messages max 4096 chars; split if needed
    full_message = header + result + footer
    chunks = _split_message(full_message, max_len=4000)

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

    async with httpx.AsyncClient(timeout=10.0) as client:
        for chunk in chunks:
            try:
                await client.post(url, json={
                    "chat_id": chat_id,
                    "text": chunk,
                    "parse_mode": "Markdown",
                    "disable_web_page_preview": True,
                })
            except Exception as e:
                print(f"[Telegram] Failed to send chunk: {e}")
                return False

    return True


def _split_message(text: str, max_len: int = 4000) -> list[str]:
    """Split long messages into Telegram-safe chunks."""
    if len(text) <= max_len:
        return [text]

    chunks = []
    while text:
        if len(text) <= max_len:
            chunks.append(text)
            break
        # Try to break on newline
        split_at = text.rfind("\n", 0, max_len)
        if split_at == -1:
            split_at = max_len
        chunks.append(text[:split_at])
        text = text[split_at:].lstrip("\n")
    return chunks
