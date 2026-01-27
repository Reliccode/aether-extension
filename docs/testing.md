# Testing Guide

## Fast checks (default)
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (Vitest unit/integration across workspaces)

## End-to-end (Playwright)
- Build + run: `pnpm e2e:build` (runs build + Playwright for the extension workspace)
- Browser install (if first run): `pnpm exec playwright install --with-deps chromium`
- Headful Chromium is required for extensions; tests seed a snippet and cover input/textarea/contenteditable plus escape-to-close.

## CI behavior
- PRs: E2E runs only when the label `run-e2e` is applied; lint/typecheck/unit always run.
- `main`: E2E runs on push.
- Nightly: E2E runs daily at 06:00 UTC.
- Playwright browsers are cached in CI to speed execution.

## Notes
- Fixture server lives at `apps/extension/tests/utils/fixture-server.ts`.
- E2E seeds snippets via the extension options page; adjust data in `apps/extension/tests/e2e/overlay.spec.ts` if snippets change.
- To seed the local IndexedDB knowledge cache with the seed pack: `pnpm --filter @aether/extension dev:load-pack`.
