from github import Github, GithubException
from config import settings

class GitHubClient:
    def __init__(self, token: str | None = None):
        self.token = token or settings.github_token
        self.client = Github(self.token) if self.token else None

    def _get_repo(self, repo_full_name: str):
        if not self.client:
            raise ValueError("GitHub token not configured")
        return self.client.get_repo(repo_full_name)

    async def create_branch(self, repo_full_name: str, base_branch: str, new_branch: str):
        """Creates a new branch from base_branch."""
        repo = self._get_repo(repo_full_name)
        try:
            source = repo.get_branch(base_branch)
            repo.create_git_ref(ref=f"refs/heads/{new_branch}", sha=source.commit.sha)
            return True
        except GithubException as e:
            if e.status == 422:  # Branch already exists
                return False
            raise

    async def commit_files(self, repo_full_name: str, branch: str, files: list[dict], commit_message: str):
        """
        Commits multiple files in a single operation.
        files: list of {"path": str, "content": str}
        """
        repo = self._get_repo(repo_full_name)
        
        # Get the latest commit of the branch
        branch_ref = repo.get_git_ref(f"heads/{branch}")
        base_commit = repo.get_git_commit(branch_ref.object.sha)
        base_tree = repo.get_git_tree(base_commit.tree.sha)

        # Create blobs for each file
        element_list = []
        for file in files:
            blob = repo.create_git_blob(file["content"], "utf-8")
            element_list.append({
                "path": file["path"],
                "mode": "100644",
                "type": "blob",
                "sha": blob.sha
            })

        # Create a new tree
        new_tree = repo.create_git_tree(element_list, base_tree)
        
        # Create a new commit
        new_commit = repo.create_git_commit(commit_message, new_tree, [base_commit])
        
        # Update the branch reference
        branch_ref.edit(new_commit.sha)
        return new_commit.sha

    async def create_pull_request(self, repo_full_name: str, title: str, body: str, head: str, base: str):
        """Creates a pull request."""
        repo = self._get_repo(repo_full_name)
        pr = repo.create_pull(title=title, body=body, head=head, base=base)
        return pr.html_url
