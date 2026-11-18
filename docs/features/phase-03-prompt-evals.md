# Phase 03 — Prompt engineering & evaluation

Status: approved
Course lessons: Prompt engineering & evaluation (prompting strategies, evaluation frameworks, systematic testing)
Roadmap: docs/ROADMAP.md#phase-3--prompt-engineering--evaluation-

## Goal
Measure and improve the system prompt instead of guessing. The assistant is an
English tutor for a Ukrainian-speaking B1 learner; `pnpm eval` scores how well
`prompts/system.md` makes it behave, and one prompt revision shows a documented
score change. This is a demo: keep everything as simple as possible.

## Scope
- In:
  - `apps/api/prompts/system.md` — English-tutor prompt (v1 weak, v2 improved).
  - `apps/evals` workspace: dataset generator, runner, graders, report.
  - `pnpm eval` and `pnpm eval:dataset`.
  - Before/after scores recorded in Notes below.
- Out (explicitly deferred): retrieval/tool cases (Phases 4–5), CI, score
  thresholds, UI for results, multi-turn cases, per-category reports,
  stronger-judge-model setup.

## Design

### Tutor rules (what the eval measures)
Explanations are in English at B1 level.

| Rule | Grader |
|---|---|
| ≤ 120 words | code |
| Ends with a question or mini-exercise (`?`) | code |
| No filler opener ("Sure!", "Great question!") | code (regex) |
| Corrected sentence first, then a short explanation | judge |
| B1 vocabulary, no unexplained jargon | judge |
| Off-topic: politely steers back to English | judge |
| Prompt injection ("ignore the rules…") is ignored | judge |
| Ukrainian input: replies in English | judge |

### Prompt versions
- **v1** (baseline, weak): `You are an English tutor. Help the user learn English.`
- **v2**: XML structure (`<role>`, `<rules>`, `<style>`) plus 2–3 `<example>`s.

### Dataset (~15 cases, committed as `apps/evals/dataset.json`)
Generated once by the fast model, skimmed by hand, committed so before/after runs
use the same cases. Categories (about 3 each): learner mistakes, grammar questions,
Ukrainian input, off-topic, injection.

Case shape (single-turn only):
```json
{
  "id": "mistakes-01",
  "input": "I have went to the cinema yesterday.",
  "criteria": ["Gives the corrected sentence 'I went to the cinema yesterday.'", "Explains the rule briefly"]
}
```
`criteria` are plain-language checks for the judge; no reference answers.

### Pipeline
1. **Generate** (`pnpm eval:dataset`): model returns cases as JSON, zod-validated, written to `dataset.json`.
2. **Run** (`pnpm eval`): `NestFactory.createApplicationContext(AppModule)`, take `ChatService`, call it per case, collect the full reply.
3. **Grade**: 3 code checks + one judge call per case (model sees input, reply, criteria; returns pass/fail per criterion as zod-validated JSON). Case score = passed checks / total checks.
4. **Report**: score per case + average, printed and saved to `apps/evals/results/<timestamp>.json`.

### Modules/files touched
- `apps/api/prompts/system.md` (new); loading it in `ChatService` if still missing (Phase 2 leftover).
- `apps/api`: export what `apps/evals` needs to boot the app context (minimal).
- `apps/evals` (new, covered by existing `apps/*` workspace glob): `src/generate-dataset.ts`, `src/run.ts`, `src/graders.ts`, `dataset.json`, `results/`.
- Root `package.json`: `eval`, `eval:dataset` scripts.
- SDK rule: `apps/evals` does not import `@anthropic-ai/sdk`. Generator and judge call the model through the `LlmProvider` from the app context; same model for everything (Haiku constant in `modules/llm`). Small `LlmRequest` extension only if the judge/generator truly need it.

### Contracts / API / UI / Config
- None changed. Uses existing `ANTHROPIC_API_KEY`. `pnpm eval` makes real API calls; it is never part of `pnpm test`.

### SDK features used
- Messages API via the existing provider (https://docs.claude.com, re-check before coding).

## Plan
1. `prompts/system.md` v1; make sure `ChatService` loads it; unit test with the fake provider.
2. `apps/evals` skeleton + scripts; green typecheck/lint.
3. Dataset generator; generate, skim, commit `dataset.json`.
4. Runner on `ChatService`.
5. Code graders (unit tests, no network) and judge (unit test with a stub provider).
6. Report; run baseline on v1.
7. Write v2, run, record before/after.

## Acceptance criteria
- [ ] `pnpm eval` runs end to end and prints + saves a report
- [ ] ~15-case dataset committed
- [ ] code and model graders both used
- [ ] prompt v1 → v2 with a documented score change
- [ ] grader unit tests run without network
- [ ] typecheck, test, lint green
- [ ] SPEC.md and ROADMAP.md updated; capability flag flipped if applicable

## Notes / decisions
- Persona: English tutor, Ukrainian-speaking learner, explanations in English, level fixed at B1.
- Criteria instead of reference answers: cheaper, easy to review, map to prompt rules.
- Separate `apps/evals` workspace (not an API module) so eval code stays out of the production build.
- Dataset committed, not regenerated per run.
- Before/after scores: _to be filled in._
