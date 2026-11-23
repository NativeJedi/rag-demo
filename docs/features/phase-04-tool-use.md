# Phase 04 — Tool use with Claude

Status: draft
Branch: `feat/phase-04-tool-use` (the whole feature lives there; nothing lands on `main` until it is reviewed)
Course lessons: Tool use with Claude (function calling, multi-turn tool interactions, parallel tool calls, tool errors)
Roadmap: docs/ROADMAP.md#phase-4--tool-use-with-claude-

## Goal
The assistant can act. The English tutor keeps a personal vocabulary dictionary:
the user says "add ephemeral, ubiquitous, lucid" and the assistant checks which
words are already there, translates the new ones into Ukrainian and saves them
with today's date. The tool work happens behind the scenes; the
user sees the final answer, and tool calls are visible in the server log.

## Scope
- In:
  - Server-side history in blocks (text, tool_use, tool_result); the web still sees plain text.
  - Tool loop in `ChatService`: call → run tools → send `tool_result` → repeat until the model stops.
  - Parallel tool calls: every `tool_use` of one model response runs concurrently, all results go back in one message.
  - Four custom tools: `get_current_datetime`, `find_words`, `add_words`, `list_words`.
  - One global dictionary stored in a JSON file (`apps/api/data/dictionary.json`, git-ignored).
  - Tool errors returned to the model as error results.
  - Logging of every tool call (name, input, result or error).
- Out of scope for now:
  - Built-in tools: text editor and web search.
  - Reading case (paste a link, get the hard words with translations, confirm, add to the dictionary) via Anthropic's server-side web fetch tool: a separate small case after this phase, specced later. Docs must confirm the tool is available for our model first.
  - Showing tool calls in the UI (cards, steps); workflow visibility is Phase 7.
  - A dedicated `batch` tool: parallel calls are handled by the loop itself.
  - Spaced repetition (review dates, reminders), persistence of conversations, `tool_choice`, streaming of partial tool input, cancelling a tool that is already running.

## Design

### The dictionary
Entry: `{ word, translation, example?, addedAt }`. `word` is lowercased and is the
key; `translation` is Ukrainian; `addedAt` is a `YYYY-MM-DD` date the model takes from
`get_current_datetime`. The model produces
translations and examples itself; there is no translate tool.

Storage: a plain JSON file, an array of entries, not a database. `DictionaryService`
loads it on first use (a missing file means an empty dictionary; an unreadable or invalid
file fails with a readable error instead of being overwritten) and rewrites it after every
`add_words` that added something (write to a temp file, then rename). Writes are chained
one after another, so two parallel `add_words` calls in one turn cannot lose each other's entries.
Conversations stay in memory; only the dictionary is persisted.

### Tools
| Tool | Input | Result |
|---|---|---|
| `get_current_datetime` | none | `{ iso, date }` (server time, UTC) |
| `find_words` | `{ words: string[] }` | `{ found: Entry[], missing: string[] }` |
| `add_words` | `{ entries: { word, translation, example?, addedAt }[] }` | `{ added: string[], skipped: { word, reason }[] }` |
| `list_words` | none | `{ entries: Entry[] }` newest first (`addedAt`, then insertion order) |

- A duplicate in `add_words` is reported in `skipped` (`reason: "already exists"`), not an error.
- Input is validated with the tool's zod schema. Invalid input (bad date, empty `words`)
  or an unknown tool name → `isError: true` result with a readable message; the model sees it and can retry.
- Each tool is `{ name, description, input: ZodSchema, run(input) }`. `ToolRegistry`
  turns the zod schemas into JSON schema for the API (check how in the zod version we use).

### Typical flow (what the prompt teaches)
"Add ephemeral and lucid":
1. Parallel: `get_current_datetime` + `find_words(["ephemeral","lucid"])`.
2. The model translates the missing words and calls `add_words` with today's date as `addedAt`
   (this call depends on both results of step 1).
3. Final text answer.

### Blocks stay on the server
- The Messages API history must contain `tool_use` and `tool_result` blocks, so `ConversationsService`
  stores messages as `blocks` and `LlmRequest` carries them. These types are api-internal; `packages/shared` does not change.
- `GET /api/conversations/:id` maps stored messages to the existing `Message { content: string }`:
  messages made only of `tool_result` blocks are skipped, consecutive assistant messages are merged
  into one (their text joined with a blank line, id of the first), `tool_use` blocks are dropped.
- `LlmProvider.stream` gets two api-internal changes: its output type carries the stop reason
  `tool_use` and the response's `tool_use` blocks. `ChatEvent` is unchanged.

### Loop (`ChatService`)
- One SSE stream per user message, with one `message_start` and one final `message_done`.
  Intermediate model calls emit only `text_delta`s; between iterations the loop streams a `"\n\n"`
  delta so the streamed text equals the merged text that `GET` returns.
- Per iteration: stream the model → collect `tool_use` blocks → run them with `Promise.all`
  (each logged) → append the assistant message and a user message with the `tool_result` blocks, in
  the order of the `tool_use` blocks → next iteration. The loop ends when the stop reason is not `tool_use`.
- Cap of 8 iterations; exceeding it ends the turn with an `error` event.
- Persistence stays in `finally`. An assistant message with `tool_use` is persisted only together
  with its `tool_result` message; if the turn is aborted or fails before the results exist, the
  dangling `tool_use` blocks are dropped (the API rejects a history with unanswered tool calls).

### Modules/files touched
- `apps/api/src/modules/tools` (new `ToolsModule`): `ToolRegistry`, executor, four tools, `DictionaryService` (JSON file).
- `apps/api` config: optional `DICTIONARY_FILE`; `.env.example` and `.gitignore`.
- `apps/api/src/modules/llm`: blocks and `tools` in `LlmRequest`; `AnthropicLlmProvider` maps tool definitions, `tool_use` and `tool_result` blocks and the `tool_use` stop reason.
- `apps/api/src/modules/chat`: the loop.
- `apps/api/src/modules/conversations`: stores blocks, maps them back to `Message`.
- `apps/api/src/test-app.ts`: the fake provider can play a scripted tool turn.
- `apps/api/prompts/system.md`: a `<tools>` section with the flow above.
- `apps/web`: not touched.

### Contract / API / Config
- `packages/shared` and HTTP endpoints do not change.
- `.env` gets one optional variable, `DICTIONARY_FILE` (default `data/dictionary.json`, relative to `apps/api`); tests point it at a temp file. `.gitignore` gets `apps/api/data/`.
- SPEC §4 (modules, `LlmProvider`, turn lifecycle) and §7 (data model) are updated.

### SDK features used (re-check on https://docs.claude.com before coding)
- Tool use overview and "implement tool use" (tool definitions, `tool_use`/`tool_result` blocks, `stop_reason: "tool_use"`).
- Parallel tool use (all results in one user message).
- Handling tool errors (`is_error`).
- Streaming with tool blocks: whether to read the finished blocks from the final message or from stream events.

## Plan
Work on branch `feat/phase-04-tool-use`, cut from `main`. This spec is the first commit
on it; the implementation is five more commits, each green on `pnpm typecheck && pnpm test && pnpm lint`
and small enough to review on its own.

1. **Blocks on the server.** `LlmRequest` and stored messages become blocks (text only), `GET` maps them to `Message`, provider mapping updated. No behaviour change.
2. **Tools infrastructure.** `ToolsModule`: registry (zod → JSON schema), executor (parallel run, error results, logging), `get_current_datetime`, unit tests.
3. **Dictionary tools.** `DictionaryService` backed by the JSON file (`DICTIONARY_FILE`), `find_words`, `add_words`, `list_words`, unit tests on a temp file.
4. **Tool loop.** Tools in `LlmRequest`, `AnthropicLlmProvider` tool mapping, stop reason `tool_use`, the `ChatService` loop (parallel run, cap, abort handling, merged text), scripted fake provider, SSE end-to-end test.
5. **Prompt and docs.** `<tools>` section in `system.md`, `pnpm eval` re-run, SPEC.md and ROADMAP.md updated, hand test with the real API.

## Acceptance criteria
- [ ] "Add ephemeral and lucid" ends with a text reply and both words in `list_words`; the server log shows `get_current_datetime` and `find_words` ran in parallel, then `add_words` with today's date
- [ ] A second request for the same word reports it as skipped
- [ ] Added words survive an API restart; a missing file is an empty dictionary, a corrupt one is a clear error and is not overwritten
- [ ] A tool error (e.g. invalid date) is returned to the model as an error result (covered by a test with the fake provider)
- [ ] Parallel execution is covered by a test (both calls start before either finishes)
- [ ] Stop mid-loop leaves a history the next message can continue from
- [ ] After a tool turn `GET` returns one merged assistant message, with no tool blocks
- [ ] Tool and loop tests run without network (fake provider / stub SDK)
- [ ] `pnpm eval` score unchanged by the prompt change
- [ ] typecheck, test, lint green
- [ ] SPEC.md and ROADMAP.md updated; capability flag flipped if applicable

## Notes / decisions
- Domain: the dictionary reuses the English-tutor persona from Phase 3 and gives every tool a reason to exist.
- No translate tool: the model translates; a tool would need a second model call for no gain.
- No `batch` tool: the course technique exists to push models toward parallel calls; Claude already emits several `tool_use` blocks per response, so the loop only has to run them concurrently.
- `add_words` takes an array (bulk parameter) instead of one call per word.
- No cards in the UI: the web is not touched in this phase, which removes new `ChatEvent` types, reducer cases and a component. The price is that tool activity is only visible in logs and tests.
- Text editor and web search are out of scope for now.
