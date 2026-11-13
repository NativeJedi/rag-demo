# Chatbot — Technical Specification

> Source of truth for architecture, contracts and conventions.
> Agents: read this file before any change. If an implementation must deviate,
> update this spec in the same change and explain why in the PR/summary.

## 1. Product

A web chat assistant built on the Claude API. It grows feature by feature while
the author works through Anthropic's "Building with the Claude API" course
(Python in the course, TypeScript here). The course is a topic guide, not a
lesson-by-lesson port: each topic becomes a product feature (see `ROADMAP.md`).

End state: streaming multi-turn chat with persistent conversations, tools and an
agent loop, image/PDF attachments with citations, extended thinking, a personal
knowledge base (hybrid RAG), prompt caching with token accounting, MCP
integration (own docs server + external servers), routing and research workflows,
and an eval suite guarding prompt quality.

Single user, local-first. Auth and multi-tenancy are out of scope unless the
roadmap is changed.

## 2. Repository layout

pnpm workspaces monorepo.

```
chatbot/
├─ apps/
│  ├─ api/                 NestJS backend
│  │  ├─ prompts/          system.md and other prompt files (versioned text)
│  │  └─ src/modules/      one Nest module per domain (see §4)
│  └─ web/                 Vite + React + Tailwind frontend
├─ packages/
│  └─ shared/              zod schemas + TS types shared by api and web
├─ evals/                  (phase 4) datasets, graders, runner
├─ docs/
│  ├─ SPEC.md              this file
│  ├─ ROADMAP.md           phases, scope, acceptance criteria
│  └─ features/            one spec per phase/feature, from _template.md
├─ CLAUDE.md               rules for coding agents
└─ .env.example
```

## 3. Tech stack

| Area | Choice | Notes |
|---|---|---|
| Runtime | Node.js 22 LTS (`engines >=22`; developed on 24) | `.nvmrc`, `engines` |
| Package manager | pnpm workspaces | |
| Language | TypeScript 5.9, `strict: true` | no `any`; `unknown` + narrowing. Not 7.x: typescript-eslint supports `<6.1` |
| API | NestJS 11 (Express adapter), CommonJS | Nest CLI with SWC builder |
| Validation | zod + `nestjs-zod` | DTOs created from shared schemas |
| LLM | `@anthropic-ai/sdk` | only inside `LlmModule` |
| Frontend | React 19, Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`) | class-based dark mode (`.dark`) |
| Server state (web) | TanStack Query | REST resources |
| Stream state (web) | `useReducer` over `ChatEvent` | single reducer, see §6 |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-highlight` | code blocks highlighted |
| Shared pkg build | `tsup` → CJS + ESM + d.ts | web may alias to source |
| Tests | Vitest everywhere (api via `unplugin-swc`), per-package config | Testing Library + jsdom on web |
| Lint/format | ESLint 9 flat config + Prettier at root | `no-explicit-any` is an error |
| Storage | phase 1: in-memory repositories; phase 3: SQLite via Drizzle + better-sqlite3 | behind repository interfaces |
| Embeddings | Voyage AI (phase 6) | |
| MCP | `@modelcontextprotocol/sdk` (phase 8) | |

Model IDs are configuration, never literals in code (see §8).

## 4. Backend architecture (apps/api)

Global prefix `/api`. Modules:

| Module | Responsibility | Phase it becomes real |
|---|---|---|
| `ConfigModule` | load `.env`, validate with zod, typed `AppConfig` | 1 |
| `HealthModule` | `GET /health` | 1 |
| `CapabilitiesModule` | models + feature flags for the UI | 1 |
| `LlmModule` | `LlmProvider` interface; `MockLlmProvider`, `AnthropicLlmProvider` | 1 (mock), 2 (real) |
| `ConversationsModule` | conversation + message repository and CRUD | 1 (memory), 3 (SQLite) |
| `ChatModule` | `ChatService`: orchestrates a turn, agent loop, emits `ChatEvent`s | 1 (pass-through), 5 (loop) |
| `ToolsModule` | tool registry, schemas, executors | 5 |
| `AttachmentsModule` | uploads (images, PDF), Files API | 7 |
| `KnowledgeModule` | documents, chunking, embeddings, BM25, hybrid search | 6 |
| `McpModule` | MCP client manager, external servers, resources, prompts | 8 |
| `WorkflowsModule` | router, chaining, parallel research | 9 |

### 4.1 LlmProvider

```ts
interface LlmProvider {
  stream(request: LlmRequest, signal: AbortSignal): AsyncIterable<ChatEvent>;
  complete(request: LlmRequest): Promise<LlmResult>; // non-streaming helper (titles, graders, routing)
}
```

- Injected via token `LLM_PROVIDER`; chosen by env `LLM_PROVIDER=mock|anthropic`.
- `LlmRequest` is our domain shape (messages, system, temperature, maxTokens,
  model alias, later: tools, thinking, cache hints). Mapping to/from SDK types
  happens only inside `AnthropicLlmProvider`.
- `MockLlmProvider` streams scripted scenarios with small delays so the UI can be
  built and tested without an API key. Scenario is picked by the user message:
  - default: echoes the input inside a markdown reply (headings, list, code block)
  - `/mock thinking` – thinking deltas, then text
  - `/mock tools` – tool_call_start → tool_call_delta… → tool_call → tool_result → text
  - `/mock citations` – text followed by citation events
  - `/mock long` – ~2,000 words, to test scrolling and stop
  - `/mock error` – emits `error` mid-stream
  The mock stays in the codebase permanently for UI work and tests.

### 4.2 ChatService turn lifecycle

1. Validate input, load conversation, append user message.
2. Build `LlmRequest` (system prompt from `prompts/system.md` unless overridden).
3. Stream from provider, forward every `ChatEvent` to the transport.
4. On completion, persist the assistant message (all blocks) and usage.
5. Phase 5+: if `stopReason === "tool_use"`, execute tools, append results,
   loop (bounded by `MAX_AGENT_STEPS`, default 8).
6. Client disconnect aborts the provider stream via `AbortSignal`; partial
   assistant output is persisted with `stopReason: "aborted"`.

Phase 1 notes: `ChatService.startTurn()` validates and records the user message
before any bytes are streamed (so a missing conversation is a plain 404), then
returns the event generator. The first user message sets a truncated placeholder
title (LLM titles: phase 2). A mid-stream `error` event ends the stream; the
partial text is persisted without a stop reason, the error itself is not stored.

## 5. HTTP API

All bodies JSON unless stated. Errors: `{ error: { code, message } }` with a
proper status. Validation failures return 400 `validation_error`, unknown ids 404 `not_found`. Endpoints not yet implemented return **501** with
`{ error: { code: "not_implemented", message: "Planned for phase N" } }`.

| Method | Path | Purpose | Phase |
|---|---|---|---|
| GET | `/api/health` | liveness | 1 |
| GET | `/api/capabilities` | `{ models, features, defaults }` | 1 |
| GET | `/api/conversations` | list (id, title, updatedAt) newest first | 1 |
| POST | `/api/conversations` | create `{ title? }` → conversation | 1 |
| GET | `/api/conversations/:id` | conversation with messages | 1 |
| PATCH | `/api/conversations/:id` | `{ title?, settings? }` (settings merged) | 1 |
| DELETE | `/api/conversations/:id` | delete → 204 | 1 |
| POST | `/api/conversations/:id/messages` | send a message, **SSE response** (§6) | 1 (mock) |
| POST | `/api/conversations/:id/title` | generate title (structured output) | 2 |
| GET | `/api/tools` | registered tools (name, description, enabled); `[]` until phase 5 | 1 (empty) → 5 |
| POST | `/api/attachments` | multipart upload → attachment id | 7 |
| GET | `/api/attachments/:id` | metadata / content | 7 |
| GET | `/api/knowledge/documents` | list documents | 6 |
| POST | `/api/knowledge/documents` | upload + index | 6 |
| DELETE | `/api/knowledge/documents/:id` | remove | 6 |
| POST | `/api/knowledge/search` | `{ query, k }` debug search | 6 |
| GET | `/api/mcp/servers` | configured MCP servers + status | 8 |
| POST | `/api/mcp/servers` | add server | 8 |
| DELETE | `/api/mcp/servers/:id` | remove server | 8 |
| GET | `/api/mcp/resources` | for `@` mentions | 8 |
| GET | `/api/mcp/prompts` | for `/` commands | 8 |

### 5.1 Send message request

```jsonc
{
  "content": "string",                 // required, 1..32k chars
  "attachments": ["att_..."],          // phase 7, optional
  "options": {                          // all optional, override conversation settings
    "model": "default" | "fast",
    "system": "string",
    "temperature": 0.0-1.0,
    "maxTokens": 1-64000,
    "thinking": { "enabled": boolean, "budgetTokens": number }   // phase 7
  }
}
```

### 5.2 Capabilities

```jsonc
{
  "models": [{ "alias": "default", "id": "<model id>", "label": "..." }, { "alias": "fast", ... }],
  "defaults": { "model": "default", "temperature": 1, "maxTokens": 4096 },
  "features": {
    "streaming": true, "tools": false, "attachments": false, "thinking": false,
    "citations": false, "knowledge": false, "mcp": false, "workflows": false
  },
  "provider": "mock" | "anthropic"
}
```

Each phase flips its flag to `true`. The UI hides or disables controls based on
these flags — never on hardcoded assumptions.

## 6. Streaming contract

`POST /api/conversations/:id/messages` responds with `Content-Type:
text/event-stream`. Implemented with a raw Express response in the controller
(Nest's `@Sse()` is GET-only). Each frame:

```
event: <ChatEvent.type>
data: <JSON of the ChatEvent>

```

Heartbeat comment `: ping` every 15 s. The stream ends after `message_done` or
`error`.

The web client reads it with `fetch` + `ReadableStream` (not `EventSource`,
which cannot POST) and aborts with `AbortController` for the Stop button.

### 6.1 ChatEvent (in `packages/shared`, zod discriminated union on `type`)

| type | payload | emitted from phase |
|---|---|---|
| `message_start` | `messageId, model` | 1 |
| `text_delta` | `text` | 1 |
| `thinking_delta` | `text` | 1 (mock) / 7 |
| `tool_call_start` | `toolUseId, name` | 1 (mock) / 5 |
| `tool_call_delta` | `toolUseId, partialJson` | 1 (mock) / 5 |
| `tool_call` | `toolUseId, name, input` | 1 (mock) / 5 |
| `tool_result` | `toolUseId, output, isError` | 1 (mock) / 5 |
| `citation` | `citedText, source: { kind, title, ref }, blockIndex` | 1 (mock) / 7 |
| `usage` | `inputTokens, outputTokens, cacheReadTokens?, cacheWriteTokens?` | 1 |
| `message_done` | `stopReason` (`end_turn` \| `max_tokens` \| `tool_use` \| `stop_sequence` \| `aborted`) | 1 |
| `error` | `code, message, retryable` | 1 |

Adding a new event type = change the union in `shared`, the mock, the provider
mapping and the web reducer in one change.

## 7. Data model (domain, storage-agnostic)

```ts
Conversation { id, title, createdAt, updatedAt, settings: ConversationSettings }
ConversationSettings { model, system?, temperature, maxTokens, thinking? }
Message { id, conversationId, role: "user" | "assistant", blocks: Block[], model?, usage?, stopReason?, createdAt }
Block =
  | { type: "text", text, citations?: Citation[] }
  | { type: "thinking", text, signature? }
  | { type: "tool_call", toolUseId, name, input }
  | { type: "tool_result", toolUseId, output, isError }
  | { type: "attachment", attachmentId, kind: "image" | "pdf" }
```

IDs: prefixed ULIDs (`conv_`, `msg_`, `att_`, `doc_`). Target layout: tool results
are stored as blocks of the following user turn, mirroring the Messages API
structure. **Phase 1 deviation:** the mock emits `tool_call` and `tool_result`
in one stream, so both are stored as blocks of the single assistant message; the
split arrives with the agent loop (phase 5).
Thinking blocks are stored with their signature so they can be sent back.

## 8. Configuration (.env)

```
PORT=3000
WEB_ORIGIN=http://localhost:5173
LLM_PROVIDER=mock                 # mock | anthropic
ANTHROPIC_API_KEY=                # required when LLM_PROVIDER=anthropic
MODEL_DEFAULT=claude-sonnet-5-5   # verify current IDs at docs.claude.com
MODEL_FAST=claude-haiku-5-5
MAX_AGENT_STEPS=8
VOYAGE_API_KEY=                   # phase 6
DATABASE_URL=file:./data/app.db   # phase 3
```

Config is validated at boot; the app fails fast with a readable message.

## 9. Frontend (apps/web)

### 9.1 Layout

- **Sidebar**: new chat button, conversation list (rename, delete), collapsible on mobile.
- **Header**: conversation title, model selector, settings button, usage badge.
- **Message list**: user/assistant bubbles; assistant markdown; auto-scroll that
  pauses when the user scrolls up; "jump to latest" button.
- **Assistant message parts** (rendered from blocks/events):
  - text with inline citation chips → popover with cited text and source
  - collapsible "Thinking" panel
  - tool call cards: name, streamed input (pretty JSON), result, error state
  - footer: stop reason, token usage (incl. cache tokens when present)
- **Composer**: autosizing textarea, Enter to send / Shift+Enter newline, Stop
  while streaming, attach button (disabled unless `features.attachments`),
  placeholder hooks for `@` mentions and `/` commands (disabled unless `features.mcp`).
- **Settings drawer**: system prompt, temperature, max tokens, thinking toggle
  and budget (disabled unless `features.thinking`), per conversation.
- Empty state with sample prompts including the `/mock …` scenarios when
  `provider === "mock"`.
- Light/dark theme following system preference, with a manual toggle.

### 9.2 Structure

```
src/
├─ api/          typed REST client, SSE reader (parseSse), query keys
├─ features/
│  ├─ chat/      chatReducer (ChatEvent → message state), useChatStream, components
│  ├─ conversations/
│  └─ settings/
├─ components/   generic UI primitives (Button, Drawer, Popover, Spinner…)
└─ lib/
```

The selected conversation lives in the URL hash (`#/c/<id>`); the app always keeps a
valid selection (newest chat, or a freshly created one). `ChatView` is keyed by
conversation id, so switching chats aborts any in-flight stream (the partial reply
is saved server-side). Stop reads: abort the fetch → server persists the partial
reply → client refetches until it appears.

`chatReducer` is the only place that interprets `ChatEvent`s; it must handle
every event type in the union (exhaustive `switch` with `never` check).

## 10. Conventions

- Shared contracts live in `packages/shared`; never duplicate a schema.
- Only `LlmModule` imports `@anthropic-ai/sdk`.
- Prompts live in `apps/api/prompts/*.md`, loaded at runtime, never inlined in code.
- Every new endpoint: zod DTO, controller test, entry in §5 table.
- Unimplemented-but-planned code paths return 501, never silently succeed.
- Tests use `MockLlmProvider`; no network in unit tests. Live API tests are
  opt-in (`pnpm test:live`) and skipped without `ANTHROPIC_API_KEY`.
- Before using an SDK/API feature, check current docs at https://docs.claude.com.

## 11. Commands (root)

| Command | Does |
|---|---|
| `pnpm dev` | builds shared, then shared (watch) + api (:3000) + web (:5173) in parallel |
| `pnpm build` | build all workspaces |
| `pnpm typecheck` | `tsc --noEmit` everywhere |
| `pnpm test` | unit tests everywhere |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm eval` | (phase 4) run eval suite |
