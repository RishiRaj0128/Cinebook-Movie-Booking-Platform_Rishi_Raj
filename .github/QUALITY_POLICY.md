# Code Quality & Security Policy

This document defines the automated quality and security thresholds enforced across the CineBook repository for all pull requests and branch merges. Every automated gate in CI maps directly to the rules detailed below.

## Mandatory failures
The CI pipeline must fail if:
1. Build fails.
2. Unit tests fail.
3. Type checking fails.
4. Critical security vulnerability is detected.
5. High severity security vulnerability is detected.
6. Supported hardcoded secret is detected.
7. Private key is detected.
8. Credential is detected.
9. Dependency has a blocked critical vulnerability.
10. Container has a critical vulnerability.
11. SAST detects a blocking security issue.
12. Required quality checks do not complete successfully.

## Warnings
The pipeline may warn (non-blocking) for:
1. Medium vulnerabilities.
2. Low vulnerabilities.
3. Code smells.
4. Minor duplication.
5. Style issues.
6. Non-critical lint warnings.

## Pull requests
A pull request cannot be merged into main unless all required checks pass.

## Main branch
Direct pushes to main are restricted; all changes go through a PR.

## Secrets
Secrets must be stored using environment variables, GitHub Secrets, or an
external secret manager. Secrets must never be committed to source control.
