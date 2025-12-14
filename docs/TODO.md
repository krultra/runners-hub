# Project TODOs

A living backlog of tasks. Use checkboxes to track progress.

## High Priority
- [x] Refactor registration form validation to be more robust
- [ ] Add success/error toasts for Admin UI action “Sync users from registrations”
- [ ] Cloud Function trigger (optional) to auto-sync `users` on `registrations` create/update
- [ ] Harden Firestore security rules for production (ensure `users/{uid}` access is restricted)
- [ ] Add invitation-only pre-registration for selected users (by invite/whitelist)
- [ ] Admin whitelist tooling for invitation-only pre-registration (filters by recent participation + marketing consent; bulk invite send; manual email add incl. non-users)
- [ ] Club/representing data quality: introduce canonical NFIF club list, normalize existing `users.representing[]`, and enforce consistent club selection going forward

## Admin & Ops
- [ ] Add npm script to tag releases and inject `REACT_APP_VERSION` from `VERSION` file automatically
- [ ] Raspberry Pi 5 deployment playbook (requirements, build, systemd service, reverse proxy)
- [ ] Improve backup script to support selective collections and GCS export option

## Data & Migrations
- [ ] DataConnect: document schemas and potential usage, or remove unused artifacts

## UI/UX
- [ ] Improve bundle size via code splitting
- [ ] Admin Registrations table: add filters/search, export CSV
- [ ] Users admin view (grid with search and quick fixes)

## Testing
- [ ] Add integration tests around registration flow and user sync
- [ ] Add CI workflow for lint/test/build

## Documentation
- [ ] Add screenshots/gifs for Admin flows
- [ ] Document email templates and workflows

---

To propose new tasks, add bullets under the appropriate section. Keep items short and actionable.
