import asyncio
import os
import sys

# Add current dir to path to import local modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from github_client import GitHubClient

async def test():
    gh = GitHubClient()
    repo_name = "dhruv-dk17/telecode"
    
    print(f"Testing with {repo_name}...")
    try:
        # Test with non-existent branch 'main' - should fall back to 'master'
        tree = await gh.get_file_tree(repo_name, "main")
        print(f"✅ Success! Found {len(tree)} files.")
        print(f"First 5 files: {tree[:5]}")
    except Exception as e:
        print(f"❌ Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test())
