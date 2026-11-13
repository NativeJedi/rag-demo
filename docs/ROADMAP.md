# Roadmap

Each phase turns one block of the "Building with the Claude API" course into a
product feature. Before starting a phase, create `docs/features/phase-NN-<slug>.md`
from `docs/features/_template.md` and get it approved. A phase is done when all
acceptance criteria pass, `pnpm typecheck && pnpm test && pnpm lint` are green,
the capability flag is flipped (if any), and SPEC.md reflects reality.

Status legend: ⬜ not started · 🟨 in progress · ✅ done

---

## Phase 1 — Skeleton ✅
**Course:** none (infrastructure).
**Goal:** a complete, polished UI and the full API surface running on the mock provider.

Scope
- pnpm monorepo, root tooling (TS, ESLint, Prettier, Vitest), `.env.example`
- `packages/shared`: all schemas from SPEC §5–7 (`ChatEvent`, DTOs, `Capabilities`, domain types)
- `apps/api`: all modules from SPEC §4 scaffolded; endpoints from SPEC §5 registered;
  phase-1 endpoints working with in-memory repositories; later endpoints return 501
- `MockLlmProvider` with all scenarios; `AnthropicLlmProvider` stub that throws "phase 2"
- SSE transport with heartbeat and abort on disconnect
- `apps/web`: full layout from SPEC §9 rendering every `ChatEvent` type via mock

Acceptance
- `pnpm dev` starts api (:3000) and web (:5173) with no API key
- every `/mock …` scenario renders correctly; Stop aborts and the partial reply stays
- conversations: create, switch, rename, delete (in memory)
- 501 endpoints respond with the planned phase
- tests: shared schema round-trips, SSE parser, `chatReducer` (all event types),
  conversations controller, mock provider scenarios

## Phase 2 — Real chat ⬜
**Course:** Accessing Claude with the API — making a request, multi-turn, system prompts, temperature, streaming, structured data.
**Goal:** talk to Claude for real.

Scope
- `AnthropicLlmProvider.stream` / `.complete` with mapping SDK ⇄ domain
- multi-turn history, system prompt from file or per-conversation override, temperature, max tokens, model alias
- usage events from the real stream
- auto title after the first exchange via structured output (fast model), `POST /conversations/:id/title`
- error mapping (rate limit, overloaded, invalid request) → `error` event with `retryable`

Acceptance
- `LLM_PROVIDER=anthropic` gives streaming replies; switching back to mock still works
- changing system prompt/temperature affects the next turn
- titles appear in the sidebar automatically
- opt-in live test passes

## Phase 3 — Persistence ⬜
**Course:** none (engineering).
**Goal:** conversations survive restarts.

Scope: Drizzle + better-sqlite3, migrations, SQLite repositories implementing the
existing interfaces, partial message persistence on abort.

Acceptance: restart keeps all conversations and blocks; repository tests run on an in-memory SQLite.

## Phase 4 — Evals & prompt engineering ⬜
**Course:** Prompt evaluation; Prompt engineering techniques.
**Goal:** measure and improve the system prompt instead of guessing.

Scope
- `evals/` workspace: dataset generation with the fast model, runner using the
  real `ChatService` (Nest application context), model-based and code-based graders
- report (score per case + average) saved to `evals/results/` and printed
- iterate `prompts/system.md` with clear/specific instructions, XML structure and examples; record before/after scores

Acceptance: `pnpm eval` runs end to end; at least one prompt revision with a documented score change.

## Phase 5 — Tools & agent loop ⬜
**Course:** Tool use with Claude.
**Goal:** the assistant can act.

Scope
- `ToolsModule` registry: zod schema → JSON schema, executor, enable/disable
- agent loop in `ChatService` (SPEC §4.2), bounded steps, parallel tool calls in one turn
- tools: current datetime, add duration to date, reminders (create/list), batch tool
- server tools: web search; text editor tool over a sandboxed `data/notes/` dir
- fine-grained tool input streaming → `tool_call_delta`
- `GET /tools` real; `features.tools = true`

Acceptance: multi-step tool use renders as cards in the UI; tool errors are surfaced to the model and the UI; loop stops at `MAX_AGENT_STEPS`.

## Phase 6 — Knowledge base (RAG) ⬜
**Course:** RAG and Agentic Search.
**Goal:** answer from the user's own documents.

Scope
- upload text/markdown/PDF-to-text into `KnowledgeModule`
- chunking strategies (size/overlap, structure-aware), Voyage embeddings, vector index
- BM25 lexical index, hybrid merge (reciprocal rank fusion), contextual retrieval (chunk context via fast model)
- `search_knowledge` tool used by the agent (agentic search); knowledge page in the UI
- eval cases for retrieval quality added to `evals/`

Acceptance: uploaded docs are retrievable; hybrid beats either index alone on the eval set; `features.knowledge = true`.

## Phase 7 — Claude features ⬜
**Course:** Features of Claude — extended thinking, images, PDF, citations, prompt caching, code execution & Files API.
**Goal:** richer inputs and outputs, lower cost.

Scope
- attachments: images and PDFs in the composer → `AttachmentsModule` → Files API
- citations on PDF/knowledge answers → `citation` events → chips in UI
- extended thinking toggle + budget; thinking blocks preserved across turns
- prompt caching: breakpoints on system prompt, tools, long documents; cache tokens in usage UI
- code execution tool (optional)

Acceptance: image and PDF questions work; citations link to sources; cache read tokens > 0 on repeated turns; flags `attachments`, `citations`, `thinking` = true.

## Phase 8 — MCP ⬜
**Course:** Model Context Protocol.
**Goal:** standard integrations.

Scope
- `packages/mcp-docs-server`: tools (read/edit doc), resources (doc list, doc content), prompts (e.g. summarize, rewrite as markdown); testable with the MCP inspector
- `McpModule`: client manager (stdio), servers configurable via API/UI, MCP tools merged into the tool registry
- UI: `@` mentions insert resources into context; `/` commands run MCP prompts

Acceptance: own server works via inspector and in chat; an external MCP server can be added; `features.mcp = true`.

## Phase 9 — Workflows & agents ⬜
**Course:** Agents and workflows.
**Goal:** smarter orchestration.

Scope
- routing: classify each request → fast vs default model and tool subset
- chaining: e.g. draft → critique → revise for long-form requests
- parallelization: "Research" mode splitting a question into sub-queries, then synthesis
- environment inspection: tools that let the agent check results of its own actions
- UI shows workflow steps; eval comparing routed vs unrouted cost/quality

Acceptance: research mode produces a synthesized answer with visible steps; routing reduces average cost on the eval set without lowering score; `features.workflows = true`.

---

## Out of scope / optional
- Computer use (course mentions it; not part of this product)
- Auth, multi-user, deployment — add a phase if needed
- Claude Code is used as the development tool throughout, not as a product feature
