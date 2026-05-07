"""
ai_engine.py — Gemini-powered AI processing for each TaskMode.

Modes:
  EXPLAIN  → Read-only. Answers questions about code / concepts.
  PLAN     → Generates a step-by-step implementation plan for a feature.
  EXECUTE  → (Phase 4) Will actually run code changes via the GitHub API.
             For now returns a structured plan + a simulated branch name.
"""

from google import genai
from google.genai import types as genai_types
from config import settings

# Instantiate once at module load
_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


MODEL = "gemini-2.0-flash"  # Fast, cost-effective; swap to gemini-1.5-pro for deeper reasoning


# ── System prompt templates ──────────────────────────────────────────────────

_SYSTEM_BASE = """You are Telecode, an expert AI coding assistant embedded inside Telegram.
You are helping a developer who is away from their computer and wants to continue coding.
Be concise, practical, and always structure your output clearly.
Use markdown formatting (headers, code blocks, bullet lists) so Telegram can render it well."""

_SYSTEM_EXPLAIN = _SYSTEM_BASE + """

Your current mode is EXPLAIN.
The user wants to understand code, a concept, or get a quick answer.
- Keep responses under 400 words unless complexity demands more.
- Use code blocks with language hints for all code examples.
- End with a one-line "Key takeaway: ..." summary."""

_SYSTEM_PLAN = _SYSTEM_BASE + """

Your current mode is PLAN.
The user wants a structured implementation plan for a new feature or change.
Output format MUST be:

## 🎯 Goal
One sentence summary of what will be built.

## 📋 Implementation Steps
Numbered list of concrete tasks. Each task should be atomic enough to be done in one commit.

## 🏗️ Files to Create / Modify
List of files with a brief note on what changes.

## ⚠️ Considerations
Key risks, gotchas, or dependencies to be aware of.

## ✅ Definition of Done
How to verify the feature is working correctly."""

_SYSTEM_EXECUTE = _SYSTEM_BASE + """

Your current mode is EXECUTE.
The user wants you to actually implement a code change.
Produce a detailed explanation and then a JSON block containing the file changes.

Format your response as:
1. A detailed description of the change.
2. The suggested branch name (format: telecode/<short-kebab-description>)
3. The suggested commit message (feat: ...)
4. A JSON block inside a code fence labeled `json` with this structure:
{
  "branch": "telecode/...",
  "commit": "feat: ...",
  "files": [
    {"path": "src/app.ts", "content": "..."},
    ...
  ]
}

Important: Provide FULL file contents in the JSON, not diffs.
"""


def _build_context(repo_full_name: str | None, repo_branch: str | None) -> str:
    if not repo_full_name:
        return "No repository is currently connected."
    return (
        f"Repository: {repo_full_name}\n"
        f"Default branch: {repo_branch or 'main'}"
    )


# ── Public interface ─────────────────────────────────────────────────────────

async def process_task(
    mode: str,
    prompt: str,
    repo_full_name: str | None = None,
    repo_default_branch: str | None = None,
) -> dict:
    """
    Send the task to Gemini and return a structured result dict.
    Returns: { "result": str, "branch_name": str | None }
    """
    client = _get_client()

    system_map = {
        "EXPLAIN": _SYSTEM_EXPLAIN,
        "PLAN": _SYSTEM_PLAN,
        "EXECUTE": _SYSTEM_EXECUTE,
    }
    system_instruction = system_map.get(mode, _SYSTEM_EXPLAIN)
    context = _build_context(repo_full_name, repo_default_branch)

    user_message = f"{context}\n\n---\n\n{prompt}"

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=user_message,
        config=genai_types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.4,
            max_output_tokens=2048,
        ),
    )

    result_text = response.text or "_(No response generated)_"

    # Extract suggested branch name from EXECUTE responses
    branch_name: str | None = None
    files_to_commit: list[dict] = []
    commit_message: str = "feat: telecode update"

    if mode == "EXECUTE":
        import json
        import re
        
        # Try to find JSON block
        json_match = re.search(r"```json\s*(\{.*?\})\s*```", result_text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1))
                branch_name = data.get("branch")
                commit_message = data.get("commit", commit_message)
                files_to_commit = data.get("files", [])
            except json.JSONDecodeError:
                pass

        # Fallback for branch name if JSON parsing failed or was incomplete
        if not branch_name:
            match = re.search(r"`(telecode/[^\s`]+)`", result_text)
            if match:
                branch_name = match.group(1)

    return {
        "result": result_text,
        "branch_name": branch_name,
        "commit_message": commit_message,
        "files": files_to_commit,
    }
