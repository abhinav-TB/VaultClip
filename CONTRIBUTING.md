# Contributing

## Code Standards

- Keep TypeScript strict. `npm run check` must pass before merging.
- Use TSDoc (`/** ... */`) for exported functions, types, classes, and shared helpers when behavior, side effects, or ownership are not obvious.
- Use `//` comments only for implementation reasoning, such as cleanup behavior, browser/runtime limitations, retry logic, or non-obvious tradeoffs.
- Do not add comments that restate the code or repeat TypeScript types.
- Prefer focused files. Split React components before they become hard to review.
- Keep Redux state serializable. Do not store `File`, `Blob`, raw bytes, model instances, or worker objects in Redux.
- Store non-serializable browser data in explicit registries or object URLs, and document ownership/cleanup.
- Worker APIs should keep typed request/response contracts and document cross-thread side effects.
- Avoid `@ts-ignore`, blanket `eslint-disable`, and unresolved `TODO`/`FIXME` comments.

## Checks

Run the full local gate:

```bash
npm run check
```

This runs:

- `npm run lint`
- `npm run check:standards`
- `npm run build`

`check:standards` catches file-size drift and banned suppressions. ESLint enforces TSDoc syntax and selected TypeScript safety rules.

## Review Checklist

- Are exported shared APIs documented where future readers need context?
- Are large UI surfaces split into focused components?
- Are browser resources such as object URLs and ffmpeg virtual files cleaned up?
- Is Redux state serializable?
- Are worker messages typed and routed through the shared worker contracts?
- Can failure states surface actionable messages to the user?
