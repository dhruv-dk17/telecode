"""
ai_engine.py — Gemini-powered AI processing for each TaskMode.

Modes:
  EXPLAIN  → Read-only. Answers questions about code / concepts.
  PLAN     → Generates a step-by-step implementation plan for a feature.
  EXECUTE  → (Phase 3) Actionable AI. Returns a structured code change plan
             and creates a simulated pull request with full file contents.
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

_SYSTEM_SEARCH = _SYSTEM_BASE + """

Your current mode is SEARCH.
Your goal is to look at the repository file tree and identify the most relevant files to read to answer the user's question.
Return ONLY a JSON list of file paths. No other text.
Example: ["src/main.ts", "package.json"]
"""

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
The user wants you to implement a code change. 
You must produce:
1. A detailed explanation of what you are changing and why.
2. A branch name starting with `telecode/`.
3. A concise commit message.
4. A JSON block containing the changes.

Output structure:
---
[Your detailed explanation here]

**Branch:** `telecode/short-description`
**Commit:** `feat: description`

```json
{
  "branch": "telecode/short-description",
  "commit": "feat: description",
  "files": [
    {
      "path": "path/to/file.ts",
      "content": "FULL file content here. NO TRUNCATION. NO '...'"
    }
  ]
}
```

CRITICAL: 
- ALWAYS provide the FULL content of the file. 
- If you are modifying an existing file, you MUST include all its original content plus your changes. 
- Use valid JSON. Double check your quotes and braces."""


def _extract_json(text: str) -> dict | None:
    """Helper to extract and parse the first JSON block from text."""
    import json
    import re

    # 1. Try to find content within ```json ... ``` blocks
    json_blocks = re.findall(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    
    # 2. If no fenced blocks, try to find the largest { ... } block
    if not json_blocks:
        json_blocks = re.findall(r"(\{.*?\})", text, re.DOTALL)

    if not json_blocks:
        return None

    # Try to parse the largest block found (usually the one with the actual data)
    # Sort by length descending
    json_blocks.sort(key=len, reverse=True)

    for block in json_blocks:
        try:
            # Clean up common AI artifacts
            cleaned = block.strip()
            # Remove trailing commas if present (invalid JSON)
            cleaned = re.sub(r",\s*([\]}])", r"\1", cleaned)
            return json.loads(cleaned)
        except json.JSONDecodeError:
            continue
            
    return None


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
        "SEARCH": _SYSTEM_SEARCH,
    }
    system_instruction = system_map.get(mode, _SYSTEM_EXPLAIN)

    # ─── Context Injection ────────────────────────────────────────────────────
    gh = None
    if repo_full_name:
        from github_client import GitHubClient
        gh = GitHubClient()
        
        # 1. Always provide the file tree if we have a repo
        file_tree = await gh.get_file_tree(repo_full_name, repo_default_branch or "main")
        tree_str = "\n".join(file_tree)
        prompt = f"Codebase Structure:\n```\n{tree_str}\n```\n\n{prompt}"

        # 2. Try to find files mentioned in the prompt and fetch them (for all modes)
        import re
        # Simple heuristic: find things that look like file paths in the prompt
        # matches words containing dots, like 'main.ts', 'src/app.py', etc.
        potential_files = re.findall(r"[\w/\-]+\.[\w]+", prompt)
        
        # Filter to only include files that actually exist in the tree
        files_to_read = [f for f in potential_files if f in file_tree]
        
        if files_to_read:
            context_files = []
            for file_path in set(files_to_read): # use set to avoid duplicates
                content = await gh.get_file_content(repo_full_name, file_path, repo_default_branch or "main")
                if content:
                    context_files.append(f"File: `{file_path}`\nContent:\n```\n{content}\n```")
            
            if context_files:
                files_str = "\n\n".join(context_files)
                prompt = f"Relevant File Context:\n{files_str}\n\n---\n\n{prompt}"

    context = _build_context(repo_full_name, repo_default_branch)
    user_message = f"{context}\n\n---\n\n{prompt}"

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=user_message,
        config=genai_types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.4,
            max_output_tokens=4096, # Increased for code generation
        ),
    )

    result_text = response.text or "_(No response generated)_"

    # Extract suggested branch name from EXECUTE responses
    branch_name: str | None = None
    files_to_commit: list[dict] = []
    commit_message: str = "feat: telecode update"

    if mode == "EXECUTE":
        import re
        data = _extract_json(result_text)
        if data:
            branch_name = data.get("branch")
            commit_message = data.get("commit", commit_message)
            files_to_commit = data.get("files", [])

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
