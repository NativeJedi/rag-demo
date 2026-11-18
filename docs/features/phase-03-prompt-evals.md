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
  - `apps/api/prompts/system.md` — English-tutor prompt (the good one); `system.bad.md` is a deliberately weak alternative kept next to it for the demo.
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
- `apps/api/prompts/system.md` — the good prompt (XML structure: `<role>`, `<rules>`, `<examples>`). This is what the app and `pnpm eval` use.
- `apps/api/prompts/system.bad.md` — a weak prompt ("helpful assistant, as detailed as possible, very enthusiastic"). Not loaded by anything; for the demo, copy it over `system.md`, run `pnpm eval`, then restore the good one and run again to compare reports.
- The examples in `system.md` must not repeat test cases from `dataset.json` (they did once and inflated the score).

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
`criteria` are a plain-language rubric for the judge; no reference answers.

### Pipeline
1. **Generate** (`pnpm eval:dataset`): model returns cases as JSON, zod-validated, written to `dataset.json`.
2. **Run** (`pnpm eval`): `NestFactory.createApplicationContext(AppModule)`, take the `LlmProvider` (it owns the system prompt) and call `complete()` per case with just the user message; no conversations, no streaming.
3. **Grade** (all scores are 0–10): 3 code checks, each exactly 0 or 10, averaged; plus one judge call per case (model sees input, reply and the criteria as a rubric; returns an integer 0–10 and reasoning, schema-validated). Case score = rounded mean of the code score and the judge score.
4. **Report**: console shows only the score per case and the average (0–10, rounded). The saved `apps/evals/results/<timestamp>.json` has the details (replies, judge reasoning, code checks) for whoever wants to dig in.

### Modules/files touched
- `apps/api/prompts/system.md` (new); loaded at runtime by `AnthropicLlmProvider`.
- `apps/api`: export what `apps/evals` needs to boot the app context (minimal).
- `apps/evals` (new, covered by existing `apps/*` workspace glob): `src/generate-dataset.ts`, `src/run.ts`, `src/graders.ts`, `dataset.json`, `results/`.
- Root `package.json`: `eval`, `eval:dataset` scripts.
- SDK rule: `apps/evals` does not import `@anthropic-ai/sdk`. Generator and judge call the model through the `LlmProvider` from the app context; same model for everything (Haiku constant in `modules/llm`). Small `LlmRequest` extension only if the judge/generator truly need it.

### Contracts / API / UI / Config
- None changed. Uses existing `ANTHROPIC_API_KEY`. `pnpm eval` makes real API calls; it is never part of `pnpm test`.

### SDK features used
- Messages API via the existing provider (https://docs.claude.com, re-check before coding).

## Plan
1. `prompts/system.md`; `AnthropicLlmProvider` loads it; unit test.
2. `apps/evals` skeleton + scripts; green typecheck/lint.
3. Dataset generator; generate, skim, commit `dataset.json`.
4. Runner on `LlmProvider.complete()`.
5. Code graders (unit tests, no network) and judge (unit test with a stub provider).
6. Report.
7. Good and bad prompt side by side; run both and record the scores.

## Acceptance criteria
- [ ] `pnpm eval` runs end to end and prints + saves a report
- [ ] ~15-case dataset committed
- [ ] code and model graders both used
- [ ] good and bad prompt with a documented score difference
- [ ] grader unit tests run without network
- [ ] typecheck, test, lint green
- [ ] SPEC.md and ROADMAP.md updated; capability flag flipped if applicable

## Notes / decisions
- Persona: English tutor, Ukrainian-speaking learner, explanations in English, level fixed at B1.
- Criteria instead of reference answers: cheaper, easy to review, map to prompt rules.
- Separate `apps/evals` workspace (not an API module) so eval code stays out of the production build.
- Dataset committed, not regenerated per run.
- Scores, not verdicts: the eval only produces numbers; whether a reply is actually good is a human call (the judge's reasoning in the JSON is there to audit it). Code checks are measurements (0 or 10), the judge is an opinion (0–10).
- Judge: a first version returned a pass/fail verdict per criterion in one array and sometimes got the length wrong; replaced by a single 0–10 score per case.
- Provider errors abort the eval; no partial scores.
- Measured once (15 cases): `system.bad.md` **3/10**, `system.md` **10/10**. Near-perfect for the good prompt means the dataset is easy; fine for a demo.
- `apps/evals/results/` is not committed; run `pnpm eval` to produce a report.
