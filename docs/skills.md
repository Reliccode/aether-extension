# Aether Engineering Skills Playbook

## 1) Context Resolver Design
- **Goal**: Fast, deterministic entity resolution in any web app.
- **Approach**:
  - Prefer config-driven strategies over hard‑coded adapters.
  - Strategy types: `urlParam`, `selectorText`, `attribute`, `labelRegex`.
  - Confidence rules: bump confidence when required fields are present (bookingId, apartmentKeyCandidates).
  - Evidence: always record the strategy that fired; surface in UI for trust.
  - Fuzzy matching: bookingId exact first, then Fuse.js over `apartmentKeyCandidates`.
- **Reliability**:
  - Patch history.push/replace, hashchange, and MutationObserver; throttle updates.
  - Load resolver configs before first detect; refresh on storage change.
  - Never log customer text; only strategy hits and ids.

## 2) Capture Mode (Admin UX)
- **Goal**: No‑code resolver authoring.
- **Steps**:
  - Enter Capture Mode (hotkey or button) → crosshair cursor.
  - Admin clicks element → record unique CSS selector + sample text.
  - Add optional regex and transform (`trimLower`, `digits`, `normalizeAddress`, `raw`).
  - Save into resolver config (per app/hosts) and persist to storage / pack.
- **Guidelines**:
  - Prefer stable selectors (data-* over nth-child).
  - Keep regex narrow; avoid over-capturing.
  - Allow multiple strategies per app; order matters.

## 3) Knowledge Packs & Caching
- **Format**: `{ source, syncedAt, records[] }` with typed fields (text/secret/link).
- **Secrets**: mask by default, `auditOnReveal` flag, audit store in IndexedDB.
- **Local cache**: IndexedDB; seed on first run; `dev:pull-notion` and `dev:load-pack` helpers.
- **Future**: bundle resolverConfig alongside packs for consistent deployments.

## 4) Testing Strategy
- **Unit**: Vitest for palette masking/reveal, DB layer.
- **E2E**: Playwright headful Chromium; fixtures cover input/textarea/contenteditable; context test (bookingId param) always on; config-driven test can be enabled once storage init is deterministic.
- **CI**: lint/type/test always; build + artifact; e2e opt‑in by label.

## 5) UI/UX Guardrails
- Palette: show confidence + evidence chips; copy/reveal per-field; pin context.
- Accessibility: ARIA listbox/option, Esc to close, Arrow nav, reduced motion friendly.
- Styling: neutral, high contrast; avoid trapping focus.

## 6) Security & Compliance
- No keystroke logging; activate only on slash/hotkey.
- Telemetry: only strategy hits and template IDs, never message content.
- Domain allowlist via resolver hosts.
- Secrets audited on reveal (timestamp, recordId, field).

## 7) Release & Versioning
- pnpm workspaces; Changesets for version bumps.
- Scripts: `pnpm lint`, `pnpm --filter @aether/extension test`, `pnpm --filter @aether/extension e2e:build`.
- Tags: semver; pack extension zip artifact in CI.
