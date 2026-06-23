# Game-engine integration (Unreal / Unity) — research & decision memo

> **Status:** RESEARCH ONLY (2026-06-23). No execution. This memo evaluates whether
> the oodim Game studio's autonomous pipeline could extend to a real engine
> (Unreal or Unity), so a future decision is made on facts, not vibes.

## The question
Today the studio ships **browser games** (pacman/galaga/doom/agar) the autonomous
way: avatars edit **text** → PRs → fast headless CI (tsc + Playwright) → cheap
**Cloudflare Worker** deploy to game.oodim.com → a **state-contract play-harness**
(`window.__game`/`__doom`) as the gate. Could that model reach Unreal/Unity?

## What changed in 2026 (the AI tooling caught up — and it's agent-capable)
- **Unreal "Aura"** (launched **2026-01-02**): Editor-Use Agent + Coding Agent —
  lights scenes, mass-edits Blueprints, writes/fixes C++ + Blueprint via prompt.
- **Unreal Engine 5.8** ships an **experimental MCP server** — Claude/Codex drive
  the Editor (spawn actors, lighting, materials, **run automation tests**).
- **Unity**: Muse **deprecated** → **Unity AI** (open beta **2026-05-04**, Unity 6,
  third-party models incl. Gemini) writes C#, generates scenes from images,
  project-context-aware. Plus an official + community **Unity MCP server** (manage
  assets/scenes/scripts, run tests) for Claude Code / Cursor.

**Takeaway:** both engines now expose **MCP servers** — an LLM *can* drive the
editor. The blocker is no longer "can an AI build an engine game"; it's *which
workflow shape*, and whether that shape fits oodim's autonomous pipeline.

## Two workflow shapes (the distinction that decides everything)
| | **MCP-editor-control** | **Headless-CI build** |
|---|---|---|
| How | Agent drives a **live/running editor** session via MCP | CI builds the project from files → WebGL |
| Engine | Unity or Unreal | Unity (GameCI `unityci/editor` Docker, `-batchmode -nographics -buildTarget WebGL -executeMethod`) |
| Fits oodim? | ✗ needs a **persistent editor** + is interactive (not issue→PR→deploy) | ✓ closer — headless + text PRs, **if content is code-first** |
| Deploy | n/a (editing) | WebGL static files → game.oodim.com Worker |

oodim = **headless CI + text PRs + cheap Worker deploy + play-harness.** The MCP
route assumes a *live editor and an interactive human/agent loop* — a departure
from the headless from-issues chain. The headless-CI route preserves the thesis.

## Fit: **Unity > Unreal** for oodim's model
- **Unity** — better fit: **C# is text-PR-able**, **GameCI** builds **WebGL
  headlessly** in CI, WebGL deploys as **static files** to game.oodim.com, and the
  **prod play-smoke gate** (`e2e-shared/prod-smoke/`) would cover it unchanged.
- **Unreal** — worse fit for *our* constraints: its web path is **Pixel Streaming
  = server-side GPU rendering streamed as video → always-on GPU cloud cost +
  bandwidth/latency**, clashing with cheap-Worker deploy. (Excellent for native /
  high-fidelity; wrong economics for web-autonomous.) C++/Blueprint also heavier
  for text PRs.

## Frictions (either path)
1. **Unity CI license** — GameCI needs `UNITY_EMAIL`/`PASSWORD`/`SERIAL` → an
   activated `.ulf` per Unity version (a credential + seat to manage).
2. **WebGL payload** — Unity WebGL is ~20–100 MB WASM vs our current few-KB canvas
   games (load time + Worker asset limits to check).
3. **Scene/asset binary layer** — avatars text-PR C# fine, but scenes/prefabs/
   `.uasset` are GUI/binary. A **code-first** project (procedural scenes, like
   Doom's code-generated assets) keeps it in the autonomous text-PR lane.

## Recommendation (for a future go/no-go — NOT now)
- **Path A — Unity-WebGL, code-first, via GameCI (recommended if we move):** the
  only option that slots into what oodim already is. Avatars edit C# (text PRs) →
  GameCI headless WebGL build (Unity license secret) → deploy to game.oodim.com →
  gated by the existing prod play-smoke. Scope a **minimal spike** first (one
  code-first scene + the harness contract) to measure WASM weight + license + CI
  time before committing.
- **Path B — operator-drives-a-live-editor via MCP (Unity/Unreal):** richer, full
  editor, uses the new MCP servers — but needs persistent hosted-editor infra and
  is interactive, i.e. a departure from the headless pipeline. Unreal here also
  carries the Pixel-Streaming GPU cost.
- **Unreal-on-web:** least fit (Pixel Streaming economics). Revisit only if a
  native/high-fidelity, server-streamed product becomes the goal.

## Sources
- Aura for Unreal — https://www.prnewswire.com/news-releases/aura-ai-assistant-for-unreal-engine-launches-vr-studio-ships-game-in-half-the-time-with-new-agent-capabilities-302651608.html
- UE 5.8 MCP server — https://byteiota.com/unreal-engine-5-8-ships-mcp-server-ai-agents-can-now-drive-the-editor/
- Unity AI open beta 2026 — https://discussions.unity.com/t/unity-ai-beta-2026-is-here/1703625
- Unity MCP (official) — https://unity.com/blog/unity-ai-mcp-how-to-get-started
- GameCI activation — https://game.ci/docs/gitlab/activation/
- Unity WebGL headless builds — https://blog.sergeantbiggs.net/posts/automated-headless-unity-builds/
- Pixel Streaming vs WebGL (Vagon) — https://vagon.io/blog/pixel-streaming-vs-webgl-vs-webgpu-the-best-solution-for-unreal-engine-web-deployment
