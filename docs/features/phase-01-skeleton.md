# Phase 1 — Skeleton

Status: done
Course lessons: none (infrastructure)
Roadmap: docs/ROADMAP.md#phase-1--skeleton-

## Goal
After this phase `pnpm dev` (no API key) gives a polished, responsive, light/dark
chat UI on :5173 talking to a NestJS API on :3000. Every `ChatEvent` type renders
from `MockLlmProvider`; conversations can be created, switched, renamed and deleted
(in memory); every later-phase endpoint exists and answers 501 with its phase.

## Scope
- In: everything listed under ROADMAP Phase 1 — monorepo + tooling, `packages/shared`
  (all schemas of SPEC §5–7), `apps/api` (all §4 modules scaffolded, all §5 endpoints
  registered, SSE per §6 with heartbeat + abort), `MockLlmProvider` (all scenarios),
  `AnthropicLlmProvider` stub, `apps/web` (full §9 UI).
- Out (deferred): real Claude calls (2), title generation (2, endpoint is 501),
  SQLite (3), evals (4), tools/agent loop (5, `GET /tools` returns `[]`), knowledge (6),
  attachments/thinking/citations backends (7), MCP (8), workflows (9).
  `@anthropic-ai/sdk`, Drizzle, Voyage, MCP SDK are **not** installed yet.

## Version decisions
Versions were checked against npm on 2026-11-12. Where `latest` differs from what the
SPEC or ecosystem compatibility requires, the pin is deliberate:

| Package | Version | Why |
|---|---|---|
| Node | 22 LTS in `.nvmrc`/`engines` (`>=22`) | SPEC §3. Local machine runs 24.5, which satisfies `>=22` |
| pnpm | 12.x (`packageManager` field) | installed locally |
| typescript | **5.9.3** | npm `latest` is 7.x, but typescript-eslint supports only `<6.1` |
| @nestjs/{common,core,platform-express,testing} | **^11.2.9** | SPEC says Nest 11; `latest` is 12 |
| @nestjs/cli | ^11.0.24 | matches Nest 11 |
| @swc/core | ^1.16 | Nest CLI SWC builder, vitest swc |
| unplugin-swc | ^2.0.0 | decorator metadata under Vitest |
| nestjs-zod | ^5.6.0 | supports zod 4 and Nest 11 |
| zod | ^4.6 | |
| rxjs, reflect-metadata | ^7.8.2, ^0.2.2 | Nest peers |
| ulid | ^3.0.2 | prefixed IDs (`conv_`, `msg_`) |
| tsup | ^8.5.1 | shared package build (CJS+ESM+d.ts) |
| vitest | ^4.1.12 | everywhere; supports Vite 6–8 |
| supertest (+ @types/supertest) | ^7.3.2 | controller/SSE e2e tests |
| react, react-dom | ^19.3.1 | |
| vite | **^7.3.8** | stable with plugin-react 5 / vitest 4; Vite 8 has tighter plugin peers |
| @vitejs/plugin-react | ^5.2.0 | |
| tailwindcss, @tailwindcss/vite | ^4.3.5 | |
| @tanstack/react-query | ^5.107 | |
| react-markdown, remark-gfm | ^10.1.0, ^4.0.1 | |
| rehype-highlight | ^7.0.2 | code block highlighting (SPEC §3 "highlighted") |
| @testing-library/{react,user-event,jest-dom} | ^16.3, ^14.6, ^7.0 | |
| jsdom | ^31 | web test env |
| eslint | **^9.39.5** | flat config; typescript-eslint peer-compatible |
| typescript-eslint, eslint-plugin-react-hooks | ^8.72, latest 5.x | |
| prettier, prettier-plugin-tailwindcss | ^3.10 | |
| tsx | ^4.23 | run scripts |
| concurrently | ^10 | `pnpm dev` |

Exact resolved versions are pinned by `pnpm-lock.yaml`. If a pin turns out
incompatible during install I will adjust and record it under Notes.

## Design

### File tree
```
rag-demo/
├─ package.json                 workspace scripts (dev/build/test/typecheck/lint/format)
├─ pnpm-workspace.yaml
├─ tsconfig.base.json           strict, ES2022, no any (noImplicitAny, noUncheckedIndexedAccess)
├─ eslint.config.mjs            flat config; @typescript-eslint/no-explicit-any = error
├─ .prettierrc  .editorconfig  .nvmrc  .gitignore  .env.example
├─ vitest.workspace.ts          (or per-package vitest configs; root `pnpm test` runs all)
├─ packages/shared/
│  ├─ package.json  tsconfig.json  tsup.config.ts  vitest.config.ts
│  └─ src/
│     ├─ index.ts
│     ├─ ids.ts                 id prefixes + id schemas
│     ├─ chat-event.ts          ChatEvent discriminated union (§6.1) + StopReason
│     ├─ domain.ts              Conversation, ConversationSettings, Message, Block, Citation, Usage
│     ├─ dto.ts                 CreateConversation, UpdateConversation, SendMessage(+options), ErrorBody
│     ├─ capabilities.ts        Capabilities, ModelAlias, Features
│     ├─ tools.ts               ToolInfo (GET /tools)
│     └─ *.test.ts              schema round-trips
├─ apps/api/
│  ├─ package.json  tsconfig.json  tsconfig.build.json  nest-cli.json (swc)  vitest.config.ts
│  ├─ prompts/system.md
│  └─ src/
│     ├─ main.ts                prefix /api, CORS (WEB_ORIGIN), ZodValidationPipe, exception filter
│     ├─ app.module.ts
│     ├─ common/
│     │  ├─ not-implemented.ts  NotImplementedPhaseException + filter → 501 body
│     │  ├─ http-exception.filter.ts   uniform { error: { code, message } }
│     │  └─ ids.ts              newId(prefix) via ulid
│     └─ modules/
│        ├─ config/             config.module.ts, config.schema.ts (zod env), app-config.ts (typed AppConfig)
│        ├─ health/             health.controller.ts
│        ├─ capabilities/       capabilities.controller.ts, capabilities.service.ts
│        ├─ llm/
│        │  ├─ llm.module.ts            provider factory on LLM_PROVIDER, token LLM_PROVIDER
│        │  ├─ llm-provider.ts          interface + LlmRequest/LlmResult
│        │  ├─ mock/mock-llm.provider.ts
│        │  ├─ mock/scenarios/          default, thinking, tools, citations, long, error (+ index)
│        │  └─ anthropic/anthropic-llm.provider.ts   stub: throws "Not implemented: phase 2"
│        ├─ conversations/      controller, service, repository interface (token),
│        │                      in-memory repository, dto.ts
│        ├─ chat/               chat.controller.ts (SSE), chat.service.ts, sse.ts (frame writer + heartbeat),
│        │                      prompt-loader.ts (reads prompts/system.md)
│        ├─ tools/              tools.controller.ts (GET /tools → []); module stub
│        ├─ attachments/        controller → 501 (phase 7)
│        ├─ knowledge/          controller → 501 (phase 6)
│        ├─ mcp/                controller → 501 (phase 8)
│        └─ workflows/          module stub only (no endpoints in §5)
│     (each real module has *.spec.ts beside it)
└─ apps/web/
   ├─ package.json  tsconfig.json  vite.config.ts (react, tailwind, /api proxy → :3000, vitest)
   ├─ index.html
   └─ src/
      ├─ main.tsx  App.tsx  index.css (tailwind v4 @theme tokens, dark variant)
      ├─ api/        client.ts (typed REST, zod-parsed), sse.ts (parseSse), stream.ts (fetch+ReadableStream),
      │              queryKeys.ts
      ├─ features/
      │  ├─ chat/    chatReducer.ts, useChatStream.ts, MessageList.tsx, MessageBubble.tsx, Markdown.tsx,
      │  │            ThinkingPanel.tsx, ToolCallCard.tsx, CitationChip.tsx (popover), MessageFooter.tsx,
      │  │            Composer.tsx, EmptyState.tsx, JumpToLatest.tsx, useAutoScroll.ts
      │  ├─ conversations/  Sidebar.tsx, ConversationItem.tsx (rename/delete), hooks (TanStack Query)
      │  └─ settings/       SettingsDrawer.tsx, ModelSelect.tsx, UsageBadge.tsx
      ├─ components/  Button, IconButton, Drawer, Popover, Spinner, Dialog, ThemeToggle
      └─ lib/         cn.ts, theme.ts, capabilities context (useCapabilities)
```

### Components and modules
**API**
- `ConfigModule` – zod-validated env → typed `AppConfig`; fails fast at boot.
- `HealthModule` – `GET /health`.
- `CapabilitiesModule` – builds `Capabilities` from config (`provider`, models from
  `MODEL_DEFAULT`/`MODEL_FAST`, all flags `false` except `streaming`).
- `LlmModule` – `LlmProvider` interface, `MockLlmProvider` (scenario chosen by user
  message prefix `/mock <name>`, small delays, honours `AbortSignal`), `AnthropicLlmProvider`
  stub; `complete()` on the mock returns a canned result.
- `ConversationsModule` – `ConversationRepository` / `MessageRepository` interfaces
  + in-memory implementations (swapped for SQLite in phase 3); CRUD controller.
- `ChatModule` – `ChatService.streamTurn()` (async generator of `ChatEvent`): validate,
  append user message, build `LlmRequest`, forward events, persist assistant message
  (partial with `stopReason: "aborted"` on abort). `ChatController` writes SSE frames on
  the raw Express response, `: ping` every 15 s, aborts via `AbortController` on `res`
  `close`, ends after `message_done`/`error`.
- `ToolsModule` (`GET /tools` → `[]`), `AttachmentsModule`, `KnowledgeModule`,
  `McpModule` – controllers registering SPEC §5 routes that throw `NotImplementedPhase(n)`;
  `WorkflowsModule` – empty module.

**Web**
- `chatReducer` – the only interpreter of `ChatEvent`; exhaustive switch with `never` check.
- `useChatStream` – owns `AbortController`, feeds reducer; on done invalidates conversation queries.
- `parseSse` – incremental parser (chunk boundaries, multi-line data, comments ignored).
- UI per SPEC §9.1: sidebar (collapsible on mobile), header (title, model selector,
  settings, usage badge), message list with pausing auto-scroll + "jump to latest",
  markdown w/ highlighted code, citation chips + popover, collapsible Thinking panel,
  tool call cards (streamed pretty JSON, result, error), footer (stop reason, usage),
  composer (autosize, Enter/Shift+Enter, Stop, disabled attach and `@`/`/` hooks),
  settings drawer (thinking controls disabled via capabilities), empty state with
  `/mock …` samples when `provider === "mock"`, light/dark following system + toggle.
  All gating through `GET /api/capabilities`.

### Contract changes (packages/shared)
New package; no prior contracts. Defines `ChatEvent` (11 types), `StopReason`, `Block`
(5 types), `Citation`, `Usage`, `Message`, `Conversation`, `ConversationSettings`,
`CreateConversationDto`, `UpdateConversationDto`, `SendMessageDto`, `ApiError`,
`Capabilities`, `ToolInfo`, id schemas. API DTOs are created from these via
`createZodDto`; web parses responses with the same schemas.

### API changes (SPEC §5)
All routes in the §5 table registered. Working: health, capabilities, conversations
CRUD, send message (SSE, mock), `GET /tools` (empty). 501 with `Planned for phase N`:
title (2), attachments (7), knowledge (6), mcp (8). Error body uniform
`{ error: { code, message } }` incl. 400 validation and 404.
`PATCH` accepts `{ title?, settings? }`. Deleting during a stream is out of scope.

### Config/env changes
`.env.example` per SPEC §8 (phase-gated vars present but commented as unused). Defaults
`LLM_PROVIDER=mock`, so no key is needed. `LLM_PROVIDER=anthropic` without key fails
validation at boot; with key it boots but the provider throws "phase 2".

### SDK features used
None (no Anthropic SDK in this phase).

## Plan
Each step leaves `pnpm typecheck && pnpm test && pnpm lint` green.
1. **Monorepo & tooling**: workspace files, tsconfig base, ESLint (no-any), Prettier,
   `.nvmrc`, `.env.example`, `.gitignore`, root scripts, vitest wiring, CI-less smoke test.
2. **packages/shared**: schemas + tsup build + round-trip tests (every ChatEvent, Block,
   DTO).
3. **API bootstrap**: Nest + SWC + vitest(unplugin-swc), `ConfigModule`, global prefix,
   zod pipe, error filter, `HealthModule`, `CapabilitiesModule` + tests.
4. **LlmModule**: interface, `MockLlmProvider` with all 6 scenarios, Anthropic stub,
   scenario tests (event sequences, abort mid-stream).
5. **ConversationsModule**: repositories (in-memory), CRUD controller, controller tests
   (404, validation, ordering newest-first).
6. **ChatModule + SSE**: `ChatService`, SSE controller, heartbeat (fake timers), abort
   on disconnect persists partial message; supertest e2e over a real SSE response.
7. **501 modules**: Tools (empty list), Attachments, Knowledge, Mcp, Workflows stub;
   one table-driven test asserting every planned route → 501 + phase.
8. **Web foundation**: Vite/React/Tailwind v4, theme tokens + dark mode, primitives,
   typed API client, TanStack Query provider, capabilities context.
9. **Stream layer**: `parseSse` + tests, `chatReducer` (+ tests, all event types),
   `useChatStream` with abort.
10. **Conversations UI**: sidebar, create/switch/rename/delete, routing by conversation id.
11. **Chat UI**: message list, auto-scroll + jump, markdown, thinking, tool cards,
    citations popover, footer/usage, composer with Stop, empty state.
12. **Settings & header**: model selector, settings drawer, usage badge, theme toggle,
    responsive polish (mobile sidebar), capability gating.
13. **Finish**: manual run-through of each `/mock` scenario in a browser (desktop +
    mobile, light + dark), tick acceptance, update ROADMAP + SPEC, write "how to try it".

## Acceptance criteria
- [x] `pnpm dev` starts api (:3000) and web (:5173) with no API key
- [x] default, `/mock thinking`, `/mock tools`, `/mock citations`, `/mock long`,
      `/mock error` each render correctly
- [x] Stop aborts the stream and the partial reply stays (also after reload)
- [x] conversations: create, switch, rename, delete (in memory)
- [x] 501 endpoints respond with `{ error: { code: "not_implemented", message: "Planned for phase N" } }`
- [x] SSE: `: ping` heartbeat every 15 s; stream ends after `message_done`/`error`;
      client disconnect aborts the provider
- [x] UI hides/disables attach, thinking, `@`/`/` based on `GET /api/capabilities`
- [x] tests: shared schema round-trips, SSE parser, `chatReducer` (all event types),
      conversations controller, mock provider scenarios (+ SSE e2e, 501 table)
- [x] no `any` (lint rule enforced); only `LlmModule` could import `@anthropic-ai/sdk`
      (not installed yet); no inline prompts
- [x] typecheck, test, lint green
- [x] SPEC.md and ROADMAP.md updated (Phase 1 ✅); no capability flag flips except
      `streaming: true`

## Notes / decisions
- **Deviations from the version table** (all resolved at install time): `prettier` pinned to
  `~3.9.10` because pnpm's `minimumReleaseAge` policy rejected 3.10.1 (published the same day);
  `@testing-library/jest-dom` ^6.6 and `jsdom` ^26 instead of ^7/^31 (conservative, no need for newer);
  `@swc/cli` added (Nest's SWC builder requires it); `lucide-react` (icons) and
  `@tailwindcss/typography` (markdown prose) added to web; `dotenv` dropped in favour of
  `process.loadEnvFile` (Node ≥ 20.12). pnpm 12 uses `allowBuilds` in `pnpm-workspace.yaml`
  instead of `onlyBuiltDependencies`. Vitest is configured per package (no root workspace file);
  api/web config files are `vitest.config.mts` / `vite.config.ts`.
- Tool results are persisted inside the same assistant message as the tool call in phase 1
  (mock emits them in one stream). SPEC §7's "next user turn" layout arrives with the agent loop (phase 5).
- A first-message truncation sets the conversation title as a placeholder; real LLM titles are phase 2.
- Mid-stream `error` keeps the partial text (persisted); the error itself is only shown live.
- Switching conversations while streaming aborts the stream (the partial reply is saved).
- Known rough edge: after an `error` event the live error banner renders as its own assistant row
  below the persisted partial text.
- Deliberate pins below `latest` (TypeScript 5.9, Nest 11, ESLint 9, Vite 7) for
  compatibility with the SPEC and typescript-eslint; revisit when the toolchain catches up.
- Message persistence in phase 1 stores user + assistant messages in memory so reload
  within a server run shows history; lost on API restart until phase 3.
- Shared package: web and api consume the built output in `dev` via `tsup --watch`;
  web may alias to `src` for faster HMR (SPEC §3).
- Open question for you: SPEC §3 says Node 22 LTS; your machine runs Node 24.5. I'll
  set `engines >=22` and `.nvmrc` 22 — tell me if you'd rather target 24.
