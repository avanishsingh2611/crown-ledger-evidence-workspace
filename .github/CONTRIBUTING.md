# Contributing to Crown & Ledger Evidence Workspace

Thank you for your interest in contributing to **Crown & Ledger Evidence Workspace**.

This repository is designed, developed, and maintained by **Avanish Singh**.

---

## Code of Conduct & Core Principles

When contributing to this repository, please adhere to the following principles:

1. **Security & Cryptographic Integrity First**:
   - Never weaken Row-Level Security (RLS) policies or RBAC middleware.
   - Never trust client-supplied identity headers (e.g. `X-User-Id`). All authentication must be verified via Supabase Auth JWT tokens.
   - Chain of Custody records and Audit Logs are strictly immutable (append-only). Never introduce `UPDATE` or `DELETE` endpoints for custody or audit records.
   - Finalized digital forensic reports under Section 65B compliance must remain permanently immutable.

2. **No Secret Commits**:
   - Never commit `.env`, `.env.local`, API keys, service-role keys, passwords, or personal credentials.
   - Ensure all environment variables follow the `.env.example` template pattern.

3. **Preserve Third-Party Licenses & Attributions**:
   - All third-party libraries, fonts, and frameworks must maintain their original copyright notices and open-source licenses.
   - When adding new dependencies, verify their open-source license compatibility and document them in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

4. **Victim / Complainant Protection**:
   - In accordance with Section 327 CrPC and sensitive digital evidence standards, victims must remain strictly isolated from internal law-firm notes, police investigative diaries, and custody management controls.

---

## Development & Verification Workflow

Before submitting a Pull Request:

1. **Type Checking & Linting**:
   ```bash
   npm run lint
   ```
   Ensure zero TypeScript compilation errors.

2. **Build Verification**:
   ```bash
   npm run build
   ```
   Verify both Vite frontend bundling and esbuild server packaging succeed cleanly.

3. **Security & Integration Verification**:
   Run the test verification suites:
   ```bash
   npx tsx scripts/verify_audit_matrix.ts
   npx tsx scripts/verify_sih_api.ts
   npx tsx scripts/verify_investigating_officer.ts
   ```

---

## Contact & Maintainer

For questions, architectural guidance, or pull request discussions, please contact the project maintainer:
- **Maintainer**: Avanish Singh
- **Repository**: Crown & Ledger Evidence Workspace
