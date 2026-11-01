# Release Checklist

Use this checklist for a change that touches API behavior, access rules, storage, or biometric processing.

## Before merge

- [ ] Update the route row in [API Reference](api.md).
- [ ] Update affected flow and trust boundary in [Architecture](architecture.md).
- [ ] Add/adjust mocked route tests for success, validation, unauthorized, forbidden, conflict, and service failure paths that apply.
- [ ] Run `npm test`, `npx tsc --noEmit --pretty false`, and focused lint.
- [ ] Run the relevant Playwright checks when UI or session behavior changes.
- [ ] Review logs, response headers, cache behavior, and error messages for secret or personal-data leakage.

## Before deployment

- [ ] Review environment variables and confirm secrets are injected through protected configuration.
- [ ] Verify `NEXTAUTH_URL`, HTTPS, trusted proxy headers, and cookie behavior on the deployed origin.
- [ ] Confirm DB backup/migration plan and test the schema against a staging database.
- [ ] Confirm private bucket policy, CORS, server IAM, Cognito IAM, Rekognition collection access, and cleanup process.
- [ ] Verify guest upload policy, public gallery, and biometric-search defaults for each event.
- [ ] Confirm monitoring catches failed uploads, event/collection partial creation, AWS errors, and cleanup failures.
- [ ] Confirm biometric notice/consent, retention, deletion, and data-subject request handling are appropriate for the deployment jurisdiction.
