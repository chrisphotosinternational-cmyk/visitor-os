# CI/CD

VISITOR-OS uses GitHub Actions to block unsafe changes before deployment.

## Pipeline

The CI workflow runs:

- Install
- Lint
- Typecheck
- Tests
- Coverage
- Build
- Migration check
- Security audit
- Package artifact
- Release artifact on tags

## Blocking Rule

The pipeline must fail if lint, typecheck, tests, build, migration check, or security audit fails.

## Package Manager

The repository uses `pnpm`.

## Release Rule

Tagged releases can publish a package artifact from CI. Production deployment remains controlled by the hosting platform.

