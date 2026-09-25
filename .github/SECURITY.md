# Security Policy

## Crown & Ledger Evidence Workspace
Secure Digital Document Management System for Legal & Investigation Documents  
**Maintained by**: Avanish Singh

---

## Supported Versions

| Version | Supported          | Security Status |
| ------- | ------------------ | --------------- |
| 1.0.x   | :white_check_mark: | Active support  |

---

## Core Security Architecture & Safeguards

Crown & Ledger Evidence Workspace incorporates multiple layers of defense-in-depth:

1. **Authentication & Identity Verification**:
   - Authentication is strictly verified server-side through Supabase Auth JWT Bearer tokens.
   - Client-supplied identity headers (e.g., `X-User-Id`) are strictly rejected and never trusted to establish user identity.
   - Service-role database keys are strictly isolated to the backend execution context and never exposed to client bundles.

2. **Row-Level Security (RLS) & Ethical Walls**:
   - PostgreSQL RLS is enabled on all core tables.
   - Matter-level ethical walls prevent attorneys and investigators from discovering or accessing unassigned legal matters.
   - Database triggers enforce unidirectional, non-recursive participant access synchronization.

3. **Cryptographic Evidence Integrity**:
   - Digital evidence uploads are verified using server-side SHA-256 binary hashing.
   - File uploads undergo MIME type and magic-byte header validation to prevent disguised payloads.
   - Signed download URLs enforce short time-to-live (TTL) expiration windows.

4. **Immutable Custody & Audit Streams**:
   - Evidence chain of custody records and audit logs are append-only.
   - Database triggers and API routes strictly prohibit `UPDATE`, `DELETE`, and `TRUNCATE` operations on custody and audit tables.
   - Forensic reports finalized under Section 65B of the Indian Evidence Act are permanently immutable.

5. **Victim / Citizen Data Protection**:
   - Citizen complainant access is strictly compartmentalized.
   - Victims are excluded from internal law-firm document archives, police internal investigation files, and forensic workbenches.

---

## Reporting a Security Vulnerability

We take the security of legal and investigation documents extremely seriously. If you discover a security vulnerability, please report it responsibly:

1. **Do Not Open a Public Issue**: Please do not file public GitHub issues for security vulnerabilities.
2. **Private Reporting**:
   - Use GitHub's private vulnerability reporting feature via the **Security** tab of this repository.
   - Alternatively, report directly to the repository maintainer (**Avanish Singh**) through your GitHub advisory or secure communication channels.
3. **Information to Include**:
   - Description of the vulnerability and its potential impact.
   - Step-by-step reproduction steps or proof-of-concept payload.
   - Affected endpoints, components, or database queries.
4. **Resolution Process**:
   - We will acknowledge receipt of your report promptly.
   - We will investigate and validate the issue in an isolated development environment.
   - Once resolved, a security advisory and patch will be released with appropriate attribution to the finder.
