# Aether Team Operating Guide (5-person squad)

## Roles (lightweight)
- **Tech Lead**: owns architecture, code health, release readiness.
- **Frontend**: extension UI/palette/options; accessibility and visuals.
- **Backend/Integrations**: connectors (Notion/Salesforce), sync/packs, telemetry.
- **QA/E2E**: Playwright harness, fixtures, flakiness watch.
- **Product/UX**: capture mode flows, admin UX, resolver/pack ergonomics.

## Weekly Rhythm
- **Planning**: pick 1–2 thin slices; define testable acceptance (unit + e2e).
- **Dev**: short branches; keep main green; use config-driven patterns first.
- **Review**: focus on correctness, safety (secrets), and UX latency.
- **Release**: Changesets bump; tag; CI artifacts zipped; opt-in e2e label for PRs.

## Architecture North Stars
- **Delivery plane, not a bot**: deterministic insertion; AI only assistive.
- **Config > Code**: resolver/adapter logic shipped as configs; capture mode to author.
- **Local-first**: cache packs in IndexedDB; graceful offline; mask secrets.
- **Observability without leakage**: record strategy hits, reveal audits—no customer text.

## Workflows
1) **Add a site/app via Capture Mode**
   - Start capture; click stable element; add regex/transform.
   - Save resolver config with hosts and strategy order.
   - Validate with fuzz match and evidence chips in palette.
2) **New knowledge source**
   - Write connector to emit KnowledgePack (records + resolverConfig optional).
   - Seed cache with `dev:pull-notion` or pack load; add minimal sync interval.
3) **Ship UI change**
   - Update options/palette; run `pnpm lint`, unit tests, and (if UI affecting) `pnpm --filter @aether/extension e2e:build`.

## Quality Bar
- E2E must pass headful Chromium.
- Secrets always masked; reveal logs to audit store.
- Context shown with confidence/evidence to avoid silent misroute.

## Decision Framework
- Prefer small, composable strategy types; avoid per-site JS adapters.
- Add telemetry only when it is content-safe and actionable.
- Keep config schema stable; version configs alongside knowledge packs.
