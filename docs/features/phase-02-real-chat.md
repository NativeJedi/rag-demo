# Phase 02 — Real chat (part 1: request + multi-turn)

Status: approved
Course lessons: making a request, multi-turn conversations
Roadmap: docs/ROADMAP.md#phase-2--real-chat-

## Goal
The chat talks to Claude for real, and follow-up messages see the whole conversation.

## Scope
- In: `AnthropicLlmProvider` (streaming), `ANTHROPIC_API_KEY` config,
  removal of `MockLlmProvider`. Multi-turn already works: `ChatService` sends full history.
- Out (rest of phase 2): system prompt, temperature, settings and PATCH, `usage`, `retryable`,
  `/capabilities`, model selector, auto title, error mapping.

## Design
- Modules touched: `LlmModule` (provider + factory), config schema, `test-app.ts` (inline fake provider).
- Contracts: none changed.
- Config: `ANTHROPIC_API_KEY` (required) joins `PORT` and `WEB_ORIGIN` in `.env`; the model ID is a constant in `LlmModule` (default: Haiku).
- SDK: `client.messages.stream` (https://docs.claude.com).

## Acceptance criteria
- [ ] `pnpm dev` with a real key streams Claude replies
- [ ] second message in a conversation sees the first (history sent)
- [ ] Stop keeps the partial reply
- [x] typecheck, test, lint green
- [x] SPEC.md and ROADMAP.md updated
