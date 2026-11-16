# Roadmap

Each phase turns one block of the "Building with the Claude API" course into a
product feature. Before starting a phase, create `docs/features/phase-NN-<slug>.md`
from `docs/features/_template.md` and get it approved. A phase is done when all
acceptance criteria pass, `pnpm typecheck && pnpm test && pnpm lint` are green,
the capability flag is flipped (if any), and SPEC.md reflects reality.

Status legend: ⬜ not started · 🟨 in progress · ✅ done

---

> **Build only what the phase needs.** Nothing is scaffolded in advance: no empty
> modules, no 501 stubs, no unused event types or schema fields. Each phase adds
> its own contracts, modules and UI, and updates SPEC.md in the same change.

## Phase 1 — Streaming chat skeleton ✅
**Course:** none (infrastructure).
**Goal:** the smallest end-to-end chat that really streams, on a mock provider.

Scope
- pnpm monorepo, root tooling (TS, ESLint, Prettier, Vitest), `.env.example`
- `packages/shared`: `ChatEvent` (message_start, text_delta, message_done, error),
  `Conversation`, `Message` (plain text), send/create DTOs
- `apps/api`: Config, Health, Llm (mock only), Conversations (in-memory maps), Chat
- SSE transport over Nest's `@Sse` (POST) with abort on disconnect
- `apps/web`: sidebar, message list with markdown and auto-scroll, composer with Stop

Acceptance
- `pnpm dev` starts api (:3000) and web (:5173) with no API key
- a message streams in word by word; Stop aborts and the partial reply stays
- `/error` surfaces an error without losing the partial text
- conversations: create, switch, delete (in memory)
- tests: shared schema round-trips, SSE parser, `chatReducer`, conversations
  controller, mock provider, chat SSE end to end

## Phase 2 — Real chat ⬜
**Course:** Accessing Claude with the API — making a request, multi-turn, system prompts, temperature, streaming, structured data.
**Goal:** talk to Claude for real.

Scope
- `AnthropicLlmProvider.stream` / `.complete` with mapping SDK ⇄ domain;
  env back: `LLM_PROVIDER`, `ANTHROPIC_API_KEY`, `MODEL_DEFAULT`, `MODEL_FAST`
- `prompts/system.md` + loader; per-conversation settings (model alias, system,
  temperature, max tokens) and `PATCH /conversations/:id`
- `usage` event + `retryable` on `error`; token badge and message footer in the UI
- `GET /capabilities` (models, defaults, provider) so the UI stops assuming;
  model selector and settings drawer
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

Scope: Drizzle + better-sqlite3, migrations, a repository seam extracted from
`ConversationsService` with a SQLite implementation, partial message persistence
on abort.

Acceptance: restart keeps all conversations and messages; repository tests run on an in-memory SQLite.

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
- `Message.content` grows into `blocks: Block[]` (text + tool_call + tool_result),
  across shared, `ChatService`, the web reducer and the message list in one change
- `ToolsModule` registry (`GET /tools`): zod schema → JSON schema, executor, enable/disable
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
