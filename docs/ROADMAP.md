# Roadmap

Each phase maps to one section of the "Building with the Claude API" course
(https://anthropic-partners.skilljar.com/claude-with-the-anthropic-api) and builds
only what that section teaches. Nothing outside the course is in scope. Before starting a phase, create `docs/features/phase-NN-<slug>.md`
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

## Phase 2 — Getting started with Claude 🟨
_Done so far: making a request and multi-turn on `AnthropicLlmProvider` (mock removed), streaming. Pending: system prompt, structured output._
**Course:** Getting started with Claude — API authentication, basic requests, conversation management, system prompts, structured output.
**Goal:** talk to Claude for real.

Scope
- `AnthropicLlmProvider.stream` with SDK ⇄ domain mapping; `ANTHROPIC_API_KEY` is the only new env var; model ID is a constant inside `modules/llm` ✅
- multi-turn: `ChatService` sends the full history ✅
- system prompt in `apps/api/prompts/system.md` + loader (no inline prompt)
- structured output: JSON via assistant prefill + stop sequence, validated with zod (provider `complete` method; no new UI)

Acceptance
- the chat gives streaming Claude replies and sees earlier messages
- the system prompt is loaded from `prompts/system.md` and changes the reply style
- structured output returns a zod-valid object (opt-in live test)

## Phase 3 — Prompt engineering & evaluation ✅
**Course:** Prompt engineering & evaluation — prompting strategies, evaluation frameworks, systematic testing.
**Goal:** measure and improve the system prompt instead of guessing.

Scope
- `apps/evals` workspace: dataset generation and model judge on the eval's own Sonnet provider, runner calling the real `LlmProvider`, which owns the system prompt (Nest application context), code-based graders
- report (score per case + average) saved to `apps/evals/results/` and printed
- `prompts/system.md` (clear rules, XML structure, examples) next to a deliberately weak `system.bad.md`; scores recorded (bad 3/10, good 10/10)

Acceptance: `pnpm eval` runs end to end; at least one prompt revision with a documented score change.

## Phase 4 — Tool use with Claude ⬜
**Course:** Tool use with Claude — function calling, multi-turn tool interactions, batch tool calling, built-in tools.
**Goal:** the assistant can act.

Scope
- server-side history in blocks (text + tool_use + tool_result); the web keeps plain text
- tool definitions (zod → JSON schema) and executor; loop in `ChatService`: call → run tools → send `tool_result` → repeat until the model stops
- parallel tool calls: all `tool_use` of one response run concurrently (replaces a separate batch tool)
- vocabulary dictionary stored in a JSON file (`DICTIONARY_FILE`) with tools: `get_current_datetime`, `find_words(words[])`, `add_words(entries[])`, `list_words`
- tool calls are logged on the server; no tool UI (workflow visibility comes in Phase 7)
- developed on its own branch `feat/phase-04-tool-use`, in five reviewable commits
- out of scope for now: built-in tools (text editor, web search); next small case after this phase: paste a link, get hard words with translations (server-side web fetch)

Acceptance: multi-step tool use (parallel calls, then a dependent call) completes with a final text reply; a tool error is returned to the model as an error result.

## Phase 5 — Retrieval augmented generation ⬜
**Course:** RAG — text chunking, embeddings, hybrid search with BM25, multi-index architectures, reranking, contextual retrieval.
**Goal:** answer from the user's own documents.

Scope
- upload text/markdown into `KnowledgeModule`
- chunking strategies (size/overlap, structure-aware), embeddings, vector index
- BM25 lexical index, hybrid merge (reciprocal rank fusion) as a multi-index search
- reranking of merged results with Claude
- contextual retrieval (chunk context generated by a fast model)
- `search_knowledge` tool for the Phase 4 loop; knowledge page in the UI
- retrieval cases added to `apps/evals`

Acceptance: uploaded docs are retrievable; hybrid (+ rerank, + contextual) beats a single index on the eval set.

## Phase 6 — Model Context Protocol (MCP) ⬜
**Course:** MCP — custom tools and resources, MCP servers and clients, full integration lifecycle.
**Goal:** standard integrations.

Scope
- `packages/mcp-docs-server`: tools (read/edit doc), resources (doc list, doc content), prompts; testable with the MCP inspector
- `McpModule`: client (stdio) connected to that server, MCP tools merged into the Phase 4 tool registry
- UI: `@` mentions insert resources into context; `/` commands run MCP prompts

Acceptance: own server works via the inspector and in chat.

## Phase 7 — Agents and workflows ⬜
**Course:** Agents and workflows — parallelization, chaining, routing, debugging.
**Goal:** orchestration patterns on top of the chat.

Scope
- chaining: draft → critique → revise for long-form requests
- parallelization: split a question into sub-queries run concurrently, then synthesize
- routing: classify a request and pick the model/prompt
- agent with tools checking the results of its own actions; workflow steps visible in the UI and logged for debugging

Acceptance: each pattern works end to end with visible steps.

---

## Out of scope
Anything not taught in the course sections above, including: persistence/database,
per-conversation settings, model selector, `/capabilities`, token usage UI, auto
titles, extended thinking, images/PDF/citations, prompt caching, code execution,
Files API, auth, deployment. Claude Code is the development tool, not a product
feature; Computer Use is not part of this product.
