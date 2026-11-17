# Phase 02 — Getting started with Claude

Status: approved
Course section: Getting started with Claude
Roadmap: docs/ROADMAP.md#phase-2--getting-started-with-claude-

## Goal
The chat talks to Claude for real, and follow-up messages see the whole conversation.

## Scope
- In: `AnthropicLlmProvider` (streaming), `ANTHROPIC_API_KEY` config, removal of
  `MockLlmProvider`, multi-turn (`ChatService` sends full history) — done.
  Still to do: system prompt from `prompts/system.md`; structured output (JSON via
  prefill + stop sequence, zod-validated).
- Out: everything not taught in this course section (see ROADMAP "Out of scope").

## Design
- Modules touched: `LlmModule` (provider + factory), config schema, `test-app.ts` (inline fake provider).
- Contracts: none changed.
- Config: `ANTHROPIC_API_KEY` (required) joins `PORT` and `WEB_ORIGIN` in `.env`; the model ID is a constant in `LlmModule` (default: Haiku).
- SDK: `client.messages.stream` (https://docs.claude.com).

## Acceptance criteria
- [ ] `pnpm dev` with a real key streams Claude replies
- [ ] second message in a conversation sees the first (history sent)
- [ ] Stop keeps the partial reply
- [ ] system prompt loaded from `prompts/system.md`
- [ ] structured output returns a zod-valid object (opt-in live test)
- [x] typecheck, test, lint green
- [x] SPEC.md and ROADMAP.md updated
