# Project status
Updated: 2026-10-26

## Goal and scope
Premium Shopify product reviews/ratings app: polished UX, reliable moderation, clean code.
Active app: `apps/shopify-remix-app` (Remix/React, MongoDB reviews, Prisma/SQLite sessions).
`apps/shopify-node-app` is a preserved experiment; `test-data` is a compatibility theme.
Work phase by phase; agree on new phases before implementation. No fixed total phase count yet.

## Progress
| Phase | Status |
| --- | --- |
| Initial project/branch analysis | Completed |
| 1. Foundation/stabilization | Implemented; local commits `97baf8b`, `d1fa5c9` |
| 2. Core review workflow | Implemented; local commit `acb1ad9`; core live tests passed |
| 3. UI/UX polish | Implemented locally, uncommitted; final QA outstanding |
| 4. Review photos/videos (approved) | Implemented locally; deployment QA outstanding |

Phase 2: validation, shop isolation, product/variant checks, moderation, public ratings,
pagination, duplicate protection, rate limits, privacy cleanup, automated tests.
Phase 3: dashboard, reviews/search/filters, form/drawer, searchable product picker with
images/details, storefront summary/cards/form guidance, movable Product rating block
with fractional SVG stars, published average/count, and jump-to-reviews. Existing components reused.
Phase 4: compact SVG rating form, improved typography/hover, optional photo/video previews,
server decoding/re-encoding, bounded MongoDB binary storage, private moderation and public galleries.
Limits: 3 files / 12 MiB input; photos 3 MiB, videos 8 MiB / first 30 seconds; stored total 8 MiB.

## Verification and release
- Passed: TypeScript, lint, tests (isolated MongoDB), production build, Shopify query/theme validation.
- Live core workflow: submit pending, publish/display/rating, reject/hide, delete test review.
- Latest UI checks: search/filter/reset, keyboard rating, validation, form reset,
  delete cancellation, picker image/search/selection retention; populated widget tested with fixtures.
- Rating block: Shopify validation and browser assertions (half stars, empty/error/invalid data,
  review jump) passed; saved below Price in draft theme; Gift Card verified at 4.0 / 2 reviews.
- Draft extension theme used for previews; no production publish or Git push performed.
- Media tests: spoofed/corrupt/oversized files, PNG/JPEG/WebP and MP4/WebM conversion,
  byte ranges, shop isolation, publication/rejection and privacy deletion passed.
- Browser: image/video selection previews, SVG keyboard rating and SVG file rejection passed.
- Local CLI/tunnel URLs are temporary; verify availability rather than reusing old URLs.

## Outstanding / next
- Final QA: physical-phone testing deferred by user; check themes, failure states, regression flows.
- Known limits: intermittent Shopify API/tunnel connectivity; existing upstream Polaris CSS build warning.
- Docker image not tested (Docker unavailable); persistent SQLite supports one instance only.
- Root README covers setup/safeguards; app README/changelog are mostly upstream template docs.
- Next: verify media submission/moderation end to end through Shopify preview, then review phase gaps.
- Keep this handoff short and current; follow root `AGENTS.md` before ending work.
