# Coverage Targets

Coverage targets for the beta production readiness phase:

- Backend: greater than 95%
- Frontend Admin: greater than 85%

## Current Scope

Backend coverage is generated with Node.js test coverage.

Frontend Admin is currently served as a lightweight static admin shell. As it grows, it should receive dedicated component and route tests before v1.0.

## Enforcement

Coverage is reported in CI. Strict numeric enforcement can be added once the test suite has stabilized around the production modules.

