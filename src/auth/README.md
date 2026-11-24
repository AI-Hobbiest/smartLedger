# Authentication and device sessions

## Planned production model

- Use OAuth 2.0 authorization-code flow with PKCE for a browser-based public client. Never embed a client secret in JavaScript or GitHub Pages.
- Sign in once per device and maintain a revocable device session. Renew tokens silently where the identity provider and policy permit.
- Do not persist passwords or raw access/refresh tokens in application storage. Use the identity SDK's supported browser cache/session controls.
- Support explicit sign-out and account switching. A revoked session or security event must return the user to authentication.
- Passkeys/WebAuthn may be added for re-authentication or optional app unlock. Biometrics are controlled by the device/browser; do not request them for every transaction.
- Authentication identifies the caller. A trusted data/API layer must enforce role and row-level authorization on every read and write.

## Development preview

The preview uses a clearly labelled, browser-local identity switcher (Demo Admin / Demo Household Member) strictly to exercise authorization rules. It is not authentication and must never be used as evidence of security. Data remains device-scoped in localStorage. Trip-only participants are attribution records and cannot sign in.

## Session policy decisions

- Keep the user signed in on a trusted device until explicit sign-out, identity-provider expiry/revocation, or a security policy requires re-authentication.
- A new device requires sign-in.
- Account switching requires an explicit user action.
- A future optional app lock can use platform biometrics/passkeys without interrupting ordinary expense entry.
- Session duration, refresh-token rotation, storage strategy and conditional-access policy must be finalized against the selected identity provider before production.
