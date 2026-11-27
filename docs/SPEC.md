# Chatbot — Technical Specification

> Source of truth for architecture, contracts and conventions.
> Agents: read this file before any change. If an implementation must deviate,
> update this spec in the same change and explain why in the PR/summary.
>
> **This file describes what exists today, not what is planned.** Nothing is
> scaffolded ahead of the phase that needs it: no empty modules, no stub
> endpoints, no unused event types. `ROADMAP.md` holds the future; each phase
> adds its own contracts, modules and UI when it is built.

## 1. Product

A web chat assistant built on the Claude API. It grows feature by feature while
the author works through Anthropic's "Building with the Claude API" course
(Python in the course, TypeScript here). Each course section becomes one phase and
builds only what the section teaches (see `ROADMAP.md`).

End state: streaming multi-turn chat with a system prompt and structured
output, an eval suite for the prompt, tool use (a vocabulary dictionary), a personal knowledge base
(hybrid RAG with reranking), MCP integration (own docs server), and
workflow/agent patterns (chaining, parallelization, routing).

Single user, local-first. Auth and multi-tenancy are out of scope unless the
roadmap is changed.

## 2. Repository layout

pnpm workspaces monorepo.

```
chatbot/
├─ apps/
│  ├─ api/                 NestJS backend
│  │  └─ src/modules/      one Nest module per domain (see §4)
│  ├─ web/                 Vite + React + Tailwind frontend
│  └─ evals/               prompt evaluation CLI (see §12)
├─ packages/
│  └─ shared/              zod schemas + TS types shared by api and web
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
| LLM | `@anthropic-ai/sdk` | only inside `LlmModule` and the evals' own provider (`apps/evals/src/llm/eval-llm.ts`) |
| Frontend | React 19, Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`) | class-based dark mode (`.dark`) |
| Server state (web) | TanStack Query | REST resources |
| Stream state (web) | `useReducer` over `ChatEvent` | single reducer, see §6 |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-highlight` | code blocks highlighted |
| Shared pkg | source-only (`exports` → `src/index.ts`), no build step | relative imports use `.ts` so Node 22.18+ can load it at runtime |
| Tests | Vitest everywhere (api via `unplugin-swc`), per-package config | Testing Library + jsdom on web |
| Lint/format | ESLint 9 flat config + Prettier at root | `no-explicit-any` is an error |
| Storage | in-memory maps inside `ConversationsService`; the vocabulary dictionary is a JSON file | |

## 4. Backend architecture (apps/api)

Global prefix `/api`. Modules that exist today:

| Module | Responsibility |
|---|---|
| `ConfigModule` | load `.env`, validate with zod, typed `AppConfig` |
| `LlmModule` | `LlmProvider` interface + `AnthropicLlmProvider` |
| `ConversationsModule` | conversations and their messages (in memory) |
| `ToolsModule` | `ToolsService` (tool definitions, parallel execution of tool calls, logging) and `DictionaryService` (JSON file) |
| `ChatModule` | `ChatService`: runs one turn and its tool loop, emits `ChatEvent`s over SSE |

Later phases add their own modules (tools, knowledge, MCP, workflows) when they are built — see `ROADMAP.md`.

### 4.1 LlmProvider

```ts
interface LlmProvider {
  stream(request: LlmRequest, signal: AbortSignal): AsyncIterable<LlmEvent>;
}
```

- Injected via the `LLM_PROVIDER` token. `AnthropicLlmProvider` is the only
  implementation; SDK mapping lives only inside it. It streams
  `client.messages.stream` (fixed `max_tokens`, model constant in `anthropic-llm.provider.ts`) and maps
  text deltas and the stop reason to `ChatEvent`s. Errors are thrown and turned into
  an `error` event by `ChatService`.
- `LlmRequest` is our domain shape: `{ messages: { role, content: ContentBlock[] }[], tools? }`.
  `ContentBlock` is `text`, `tool_use` or `tool_result`, shaped like the Messages API.
  The system prompt comes from `prompts/system.md`.
- `LlmEvent` is `ChatEvent` without `message_start`, plus `{ type: 'tool_use', blocks }`:
  a response that ends in `tool_use` finishes with that event (all calls of the response)
  instead of `message_done`. `LlmEvent` is api-internal; `ChatEvent` is unchanged.

### 4.2 ChatService turn lifecycle

`ChatService` has one public method, the async generator `streamReply()`. A turn
reads top to bottom:

1. Load the conversation (throws → 404), snapshot the history, append the user
   message. The first message sets a truncated title.
2. Emit `message_start` with the id the assistant message will be persisted
   under, then loop (at most 8 model calls, else an `error` event `tool_loop_limit`):
   stream the model, forwarding `text_delta`s and accumulating the text. If the response
   ends in `tool_use`, run all its calls concurrently with `ToolsService.runAll`, store
   the assistant message (text + `tool_use` blocks) together with a user message of
   `tool_result` blocks (same order as the calls), and call the model again. The client
   sees one stream: one `message_start`, all text deltas, one final `message_done`.
3. Persist in a `finally`, so a Stop or an error still keeps whatever the model
   managed to say. Tool calls are stored only together with their results, so a turn
   stopped mid-tool round leaves a history the API accepts.

### 4.3 Tools

`ToolsService` holds four tools — `{ name, description, input_schema, run }`, the schema
made from a zod schema with `z.toJSONSchema`. `run` validates the raw input itself;
invalid input, an unknown tool or a thrown error becomes a `tool_result` with `is_error: true`
and a readable message, so the model can retry. Every call and its result or error is logged.

| Tool | Input | Result |
|---|---|---|
| `get_current_datetime` | none | `{ iso, date }` (UTC) |
| `find_words` | `{ words: string[] }` | `{ found: Entry[], missing: string[] }` |
| `add_words` | `{ entries: Entry[] }` | `{ added: string[], skipped: { word, reason }[] }` (a duplicate is skipped, not an error) |
| `list_words` | none | `{ entries: Entry[] }`, newest first |

`DictionaryService` keeps one global dictionary in a JSON array (`DICTIONARY_FILE`): loaded on
first use (a missing file is empty, a corrupt one fails and is not overwritten), rewritten
via a temp file after every `add_words` that added something; writes are chained, so parallel
adds do not lose entries. The prompt (`<tools>` in `system.md`) teaches the flow:
`get_current_datetime` + `find_words` in parallel, then `add_words` with today's date.

Because `@Sse` holds the headers until the first event, the throw in step 1 still
reaches the exception filter and comes back as a JSON 404, not a stream.

A mid-stream `error` event ends the turn; the partial text is persisted without a
stop reason, the error itself is not stored. A turn that ends with neither
`message_done` nor `error` was cut short by the client → `stopReason: "aborted"`.

## 5. HTTP API

All bodies JSON unless stated. Errors: `{ error: { code, message } }` with a
proper status. Validation failures return 400 `validation_error`, unknown ids
404 `not_found`. A path that does not exist yet simply 404s — there are no
placeholder routes.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/conversations` | list (id, title, updatedAt) newest first |
| POST | `/api/conversations` | create `{ title? }` → conversation |
| GET | `/api/conversations/:id` | conversation with messages |
| DELETE | `/api/conversations/:id` | delete → 204 |
| POST | `/api/conversations/:id/messages` | send a message, **SSE response** (§6) |

### 5.1 Send message request

```jsonc
{ "content": "string" }   // required, 1..32k chars
```

The request carries only the message text.

## 6. Streaming contract

`POST /api/conversations/:id/messages` responds with `Content-Type:
text/event-stream`. Each frame:

```
event: <ChatEvent.type>
id: <counter Nest adds>
data: <JSON of the ChatEvent>

```

The stream ends after `message_done` or `error`.

**Server side** — Nest's own SSE support, nothing hand-rolled:

```ts
@Sse(':id/messages', { method: RequestMethod.POST })
@HttpCode(200)
send(@Param('id') id, @Body() body, @SseSignal() signal): Observable<MessageEvent> {
  return from(this.chat.streamReply(id, body, signal)).pipe(
    map((event) => ({ type: event.type, data: event })),
  );
}
```

`@Sse` takes `{ method }` since Nest 11, so SSE over POST needs no `@Res()`.
Nest writes the headers (including `X-Accel-Buffering: no`), formats the frames,
handles backpressure and ends the response. It defers the headers until the
first event, so a throw during setup — an unknown conversation — still becomes a
JSON 404. `@SseSignal()` hands the handler an `AbortSignal` that aborts when the
client disconnects; it is passed to the provider so its own request is cancelled.
Unsubscribing closes the generator, so `ChatService`'s `finally` saves the
partial reply either way.

The signal also aborts on *normal* completion, so it cannot tell a Stop from a
finished turn. `ChatService` decides instead by what it saw: no `message_done`
and no `error` means the stream was cut short → `stopReason: "aborted"`.

**Client side** — `fetch` + `ReadableStream` (not `EventSource`, which cannot
POST), piped through `EventSourceParserStream` from `eventsource-parser`.
`streamMessage()` is an async generator of validated `ChatEvent`s, so the caller
writes `for await (const event of streamMessage(…))`; aborting its signal closes
the connection, which the server treats as Stop.

### 6.1 ChatEvent (in `packages/shared`, zod discriminated union on `type`)

| type | payload |
|---|---|
| `message_start` | `messageId` |
| `text_delta` | `text` |
| `message_done` | `stopReason` (`end_turn` \| `max_tokens` \| `aborted`) |
| `error` | `code, message` |

Adding an event type is a deliberate, four-place change: the union in `shared`,
the real provider's mapping and the web `chatReducer` — in
one commit. Tool calls are not events: the web does not see them (workflow visibility is phase 7).

## 7. Data model (domain, storage-agnostic)

```ts
Conversation { id, title, createdAt, updatedAt }
Message { id, conversationId, role: "user" | "assistant", content: string, stopReason?, createdAt }
Entry { word, translation, example?, addedAt }   // dictionary, `word` lowercased is the key
```

IDs are prefixed ULIDs (`conv_`, `msg_`).

`Message` (the web's view) is plain text. The server stores messages as `ContentBlock[]`
(`StoredMessage`, api-internal, see §4.1) because tool calls need `tool_use` and `tool_result`
blocks in the history. `GET /api/conversations/:id` maps them to `Message`: messages made only of
`tool_result` blocks are skipped, `tool_use` blocks are dropped, consecutive assistant messages
(one tool turn) are merged into one — text concatenated, id of the first — so the streamed text
equals what `GET` returns.

## 8. Configuration (.env)

```
PORT=3000
WEB_ORIGIN=http://localhost:5173
ANTHROPIC_API_KEY=
SYSTEM_PROMPT_FILE=system.md   # optional: a file in apps/api/prompts/ (evals use it to compare prompts)
DICTIONARY_FILE=data/dictionary.json   # optional: relative paths resolve from apps/api; git-ignored
```

Config is validated at boot; the app fails fast with a readable message.
`ANTHROPIC_API_KEY` is required.
Model IDs are constants inside `AnthropicLlmProvider` (chat) and `apps/evals/src/llm/eval-llm.ts` (evals), never literals elsewhere.

## 9. Frontend (apps/web)

### 9.1 Layout

A demo UI: every pixel on screen is part of the chat flow. No theme switcher, no
collapsible panels, no modals, no routing — those hide the thing being
demonstrated. Two columns, always visible.

- **Sidebar** (fixed, 16rem): new chat button, conversation list, `✕` to delete
  (no confirmation — it is a demo).
- **Header**: conversation title.
- **Message list**: user bubbles right, assistant markdown left; scrolls to the
  bottom on every render so a streaming reply stays in view; "Stopped by you"
  under an interrupted reply; the error banner next to the partial text.
- **Composer**: textarea, Enter to send / Shift+Enter newline, one button that is
  Send or Stop.
- Empty state: two sample prompts that send on click (a sentence with a mistake to correct, and a question in Ukrainian), matching the English-tutor prompt.

### 9.2 Structure

```
src/
├─ api/          typed REST client, streamMessage() SSE generator, query keys
├─ features/
│  ├─ chat/      chatReducer (ChatEvent → message state), useChatStream, components
│  └─ conversations/
└─ lib/cn.ts     className joiner
```

The selected conversation is `useState` in `App` (no router): it falls back to
the newest chat, and the first load creates one so the demo opens ready to type.

`ChatView` is keyed by conversation id, so switching chats unmounts
`useChatStream` and aborts any in-flight stream (the partial reply is saved
server-side). Stop reads: abort the fetch → server persists the partial reply →
client refetches until it appears.

`chatReducer` is the only place that interprets `ChatEvent`s; it must handle
every event type in the union (exhaustive `switch` with `never` check).

## 10. Conventions

- **Build only what the current phase needs.** No empty modules, stub endpoints,
  unused schema fields or dead UI branches for later phases. The roadmap is the
  plan; the code is what works.
- Shared contracts live in `packages/shared`; never duplicate a schema.
- Only `LlmModule` and the evals' own provider (`apps/evals/src/llm/eval-llm.ts`) import `@anthropic-ai/sdk`.
- Prompts live in `apps/api/prompts/*.md` (eval prompts in `apps/evals/prompts/*.md`), loaded at runtime, never inlined in code.
- Every new endpoint: zod DTO, controller test, entry in §5 table.
- Tests use the fake provider in `test-app.ts` or a stub SDK client; no network in unit tests. Live API tests are
  opt-in (`pnpm test:live`) and skipped without `ANTHROPIC_API_KEY`.
- Before using an SDK/API feature, check current docs at https://docs.claude.com.

## 11. Commands (root)

| Command | Does |
|---|---|
| `pnpm dev` | api (:3000) + web (:5173) in parallel |
| `pnpm build` | build all workspaces |
| `pnpm typecheck` | `tsc --noEmit` everywhere |
| `pnpm test` | unit tests everywhere |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm eval` | score `apps/api/prompts/system.md` on `apps/evals/dataset.json`, print scores, save details to `apps/evals/results/` (real API calls) |
| `pnpm eval:dataset` | regenerate `apps/evals/dataset.json` with the model |

## 12. Evals (apps/evals)

A CLI, not part of the API build. It boots the API's Nest application context from
source (`@chatbot/api/src/*`, run with `@swc-node/register` so decorator metadata
works) and takes `LlmProvider` from it: that is the chat under test. Dataset generation
and judging go through the eval's own provider (`llm/eval-llm.ts`, `EvalLlm`), which calls the
SDK directly with a hardcoded Sonnet model, one level above the chat's Haiku.

- `dataset.json`: ~15 single-turn cases (`id`, `category`, `input`, `criteria`),
  generated once by `pnpm eval:dataset` and committed.
- Layout: two entry points in `src/` (`generate-dataset.ts` → `DatasetGenerator`,
  `run-eval.ts` → `Evaluator`) that only wire dependencies and do file I/O; the rest is
  modules `llm/` (`EvalLlm`), `utils/` (env loading, prompt templates), `dataset/` (`Case` contract, file,
  generator) and `evaluation/` (evaluator, `ModelEval`, `CodeEval`, report). Dependencies
  point one way: `evaluation` → `dataset` → `llm`; `utils/` is used by any of them.
- Evaluator: `LlmProvider.stream()` per case with only the user message, text deltas
  collected into the reply; the provider's system prompt (`prompts/system.md`) is what is being tested. A provider error
  aborts the run.
- Grading, all 0–10: `Evaluator` keeps a list of `CaseEval`s (`evaluate(case, reply)` →
  `{ name, score, details }`) and runs each on every reply. `CodeEval`: three checks (≤120
  words, ends with a question, no filler opener), each exactly 0 or 10 and averaged.
  `ModelEval`: one judge call per case (`EvalLlm.completeJson`, criteria as rubric,
  integer 0–10 + reasoning). Case score = rounded mean of the evaluations; the average is
  computed inside `Evaluator` as the rounded mean of the case scores.
- Output: console shows scores only; `results/<timestamp>.json` (git-ignored) has
  replies and every evaluation's details (judge reasoning, code checks).
- Prompts for the generator and judge live in `apps/evals/prompts/`.
- `EvalLlm.completeJson()` is schema-constrained via `output_config.format`;
  `LlmProvider` itself is unchanged by evals.
