# Repository scope

- Godseye owns the geospatial viewer, public-data integrations, scene-state contracts, evidence packets, and its browser automation boundary.
- Godseye is independent from Apollo. Do not import Apollo branding, organic visual language, consumer workflow, or private robustness logic.
- TraderCockpit may consume only Godseye's versioned automation and evidence contracts.
- Futures and Register are context-only unless the operator explicitly opens a task in those repositories. Do not edit, test, generate files in, stage, or clean them from this repository task.
- Do not borrow dependencies or installations from another repository.

# ponytail

The `ponytail:ponytail` plugin skill is mandatory for every task in this repository. Reuse the existing Cesium viewer, browser APIs, and installed dependencies; avoid new frameworks and speculative abstractions; leave the smallest verified change that satisfies the request.

# skill-first execution

Before any substantive task action—including planning, coding, editing, inventing a workflow, adding a dependency, or calling general-purpose tools—map the intent against the active skill catalog. If a matching skill exists, announce it, read its `SKILL.md` completely, and use it before other task actions; user-named skills take priority. Use the narrowest matching set and reuse its scripts, assets, templates, and native workflow. If no matching skill is available, state the fallback briefly and take the simplest direct path.

# Obsidian vault freshness

At every meaningful state transition—including branch, pull request, test, campaign, decision, merge, deploy, and handoff—and before closing a task, re-derive live facts from source systems, then update relevant existing vault notes and the vault's index, log, and hot cache according to `CLAUDE.md`. Date state claims and include verification commands or receipts. Never create duplicate notes or treat older vault prose as current state.

# deploy

Sol may proactively create a separate, exact-project Luna task using model `gpt-5.6-luna` and reasoning effort `max` when scope, acceptance criteria, project, branch/PR state, permitted authority, and side effects are trustworthy and unambiguous. Every Luna task is project-scoped in the exact same saved project folder as its originating task and handles one repository and one pull request.

When the operator gives `deploy` as a direct instruction, the originating task must stop staging, committing, pushing, mutating a pull request, merging, releasing, or performing post-merge actions. Sol hands deployment to a separate Luna task:

- Resolve the saved Codex project whose canonical folder exactly matches this active repository.
- Use model `gpt-5.6-luna` with reasoning effort `max`.
- Target that exact project and repository folder, using the current branch or a worktree starting from the current branch.
- Never create a projectless task.
- If the exact project, model, or maximum reasoning mode is unavailable, fail closed and ask the operator to correct the project configuration. Do not substitute another model or location.

Sol remains accountable for implementation review and approves final merge readiness. Luna owns its assigned deployment workflow through merge and post-merge verification when deployment is included.

Pass Luna a deployment packet containing:

- Repository and canonical worktree paths.
- Current branch, base branch, and commit.
- Pull-request URL and state, if one exists.
- Requested deployment outcome and approved acceptance criteria.
- Changed-file inventory and intentionally excluded files.
- Tests, builds, contract checks, and review evidence already completed.
- Known risks, required approvals, secrets boundaries, and rollback notes.

Luna owns the repeatable deployment workflow:

1. Reconfirm repository, worktree, branch, and diff state.
2. Stage only files already reviewed by the primary task.
3. Commit intentionally and push the intended branch.
4. Create or update the pull request.
5. Monitor CI and review status.
6. Return substantive product, architecture, contract, dependency, claim, migration, credential, or scope changes to the primary task for review.
7. Merge only after the primary task approves the final diff and evidence.
8. Verify the default branch and the explicitly requested post-merge target.

The primary task remains responsible for implementation, full-diff review, test adequacy, and merge approval. Luna performs deployment actions after that approval. One Luna task handles one repository and one pull request. Cross-repository releases require separate Luna tasks and an explicit merge order. Production publication occurs only when the operator explicitly includes it in the deployment instruction.

# esq-battery-ops

- **esq-battery-ops** (`~/.agents/skills/esq-battery-ops/SKILL.md`) launches, monitors, diagnoses, and recovers ESQ library-cycle battery runs.
- Trigger: `/esq-battery-ops` or a request to monitor, resume, or triage an ESQ battery/backtest run.
- Use the skill before doing anything else for those requests.

# graphify

- **graphify** (`~/.agents/skills/graphify/SKILL.md`) turns project inputs into a knowledge graph.
- Trigger: `/graphify`.
- Use the skill before doing anything else when the operator invokes it.

# openmontage

- **openmontage** (`~/.agents/skills/openmontage/SKILL.md`) produces YouTube videos, Shorts, Reels, and TikToks from a brief.
- Trigger: `/openmontage` or any request to create or edit a video, montage, explainer, Short, or Reel.
- Use the skill for those requests.

# see-video

- **see-video** (`~/.agents/skills/see-video/SKILL.md`) extracts frames from a YouTube URL, direct video URL, or local video so Codex can inspect it.
- Trigger: `/see-video` or a request to inspect what is shown in a shared video.
- Use the skill for those requests.

# tiktok-upload

- **tiktok-upload** (`~/.agents/skills/tiktok-upload/SKILL.md`) posts a finished 9:16 MP4 to TikTok using the local cookie-based uploader.
- Trigger: `/tiktok-upload` or any request to post or upload a video to TikTok.
- Use the skill for those requests.
