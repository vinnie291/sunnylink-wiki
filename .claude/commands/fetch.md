---
description: Fetch latest from the remote and report what's new on the current branch
---

Run these steps to pick up any changes the user pushed from Antigravity (or another machine) without altering the working tree.

1. Fetch all refs from origin (prunes deleted branches):
   ```bash
   git fetch --prune origin
   ```

2. Show the current branch's status vs. its upstream:
   ```bash
   git status --short --branch
   ```

3. If the branch is behind its upstream, list the new commits so the user can see what arrived:
   ```bash
   git log --oneline HEAD..@{upstream} 2>/dev/null
   ```

4. If `$ARGUMENTS` is non-empty, treat it as a branch name and additionally show recent commits on that branch:
   ```bash
   git log --oneline -10 origin/$ARGUMENTS 2>/dev/null
   ```

After running, briefly summarize:
- Whether the local branch is up to date, ahead, behind, or diverged.
- A one-line list of any new commits picked up.
- If behind, suggest `git pull` (or `git rebase origin/<branch>`) — but do NOT run it automatically; the user might have uncommitted work.
