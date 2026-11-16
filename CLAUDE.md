# CLAUDE.md

Web chatbot on the Claude API, built phase by phase while following Anthropic's
"Building with the Claude API" course. Stack: pnpm monorepo, NestJS API,
React + Tailwind web, shared zod contracts.

## Read first
- docs/SPEC.md — architecture, contracts, conventions (source of truth)
- docs/ROADMAP.md — phases, scope, acceptance criteria, status
- docs/features/ — spec of the current phase

## Workflow for every phase or feature
1. Find the current phase in ROADMAP.md. Do not implement anything from later phases.
2. If docs/features/phase-NN-*.md does not exist, write it from _template.md
   and stop for approval before coding.
3. Implement in small steps; keep `pnpm typecheck && pnpm test && pnpm lint` green.
4. Finish: tick acceptance criteria, update ROADMAP status, update SPEC.md where
   reality changed, flip the capability flag, summarize what changed and how to try it.

## Hard rules
- Build only what the current phase needs. No empty modules, stub endpoints,
  unused schema fields or dead UI branches for later phases. Delete, don't park.
- Contracts live only in packages/shared. Changing ChatEvent means updating
  shared, AnthropicLlmProvider mapping and the web chatReducer together.
- Only LlmModule imports @anthropic-ai/sdk. Model IDs only as constants in LlmModule.
- Prompts live in apps/api/prompts/*.md, never inline.
- Unit tests never hit the network; use the fake provider in apps/api/src/test-app.ts or a stub SDK client.
- No `any`. Prefer small, readable code over abstractions not needed yet.
- Check https://docs.claude.com before using an SDK/API feature; SDK names
  change between versions.

## Commands
pnpm dev | pnpm test | pnpm typecheck | pnpm lint | pnpm build | pnpm eval (phase 4+)
