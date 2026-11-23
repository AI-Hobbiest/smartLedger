# Smart Ledger — Ganathe Finance

A personal-finance PWA with a first-party conversational interface and forms as a fallback.

## Current development build
The foundation-v2 branch is the feature-development workspace. It includes a responsive dashboard, deterministic local command parsing, reviewed transaction entry, transaction management, trips, monthly budgets, reports and development backup/import/export.

**Development storage is browser-local and device-specific.** It is not synced, encrypted or suitable for real financial records. The GitHub repository stores application source and tests only; never commit financial records, credentials, tokens, encryption keys or real backups.

## Storage direction
Production storage is intentionally deferred until feature work is complete. The planned personal-release provider is a client-side encrypted, versioned JSON vault in OneDrive. A future SaaS database/API will implement the same repository contract. No personal Entra setup is required for the current development build.

## How to run
Serve the repository root over HTTPS or use a local static web server. Use synthetic/test data only. Browser storage does not synchronise between devices or browser profiles.

## Repository layout
- assets/js/ledger-core.js — provider-independent finance parsing and date logic
- assets/js/ledger-repository.js — versioned development repository implementation
- assets/js/app.js — application UI and feature orchestration
- assets/css/app.css — responsive interface
- tests — parser and repository regression tests
- docs — architecture and storage migration decisions

## Not yet production-ready
Encrypted OneDrive vault, cross-device sync, encryption recovery, conflict resolution and SaaS database authentication remain future release gates.
