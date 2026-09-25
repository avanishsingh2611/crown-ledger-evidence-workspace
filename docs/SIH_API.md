# Crown & Ledger Evidence Workspace — Backend API Reference
**Author & Maintainer:** Avanish Singh

This document provides the technical specification, authorization boundaries, request/response models, and security restrictions for the Crown & Ledger Evidence Workspace backend API endpoints.

---

## Architecture & Authentication Overview

- **Authentication Protocol**: Verified Supabase Auth JWT session tokens passed via `Authorization: Bearer <token>`.
- **Identity Integrity**: Client-supplied headers (e.g. `X-User-Id`), frontend metadata, and unverified claims are strictly ignored. All user attributes (`id`, `role`, `email`, `fullName`) are derived directly from the verified Supabase Auth session and synchronized database profile.
- **Access Control Model**: Layered Role-Based Access Control (RBAC), Matter-Level Ethical Wall Authorization, Case Participant Authorization, and PostgreSQL Row-Level Security (RLS) enforcement.
- **Audit Stream**: High-integrity, immutable audit events generated synchronously upon critical mutations (case creation, participant assignment, Section 65B hash certification, custody handovers, hearing scheduling).

---

## 1. Court Cases API

Mounted at `/api/cases`. Managed by `caseService.ts`.

### 1.1. List Authorized Court Cases
- **Endpoint**: `GET /api/cases`
- **Authentication**: Required (`Bearer <token>`)
- **Allowed Roles**:
  - `workspace_admin`: Full access to all cases across the firm.
  - `auditor`: Compliance visibility across all cases.
  - `judge`: Assigned cases where the user is presiding judge or assigned participant.
  - `attorney`: Assigned matter cases (lead attorney or matter member).
  - `forensic_team`: Assigned cases (assigned via `case_participants`).
  - `victim`: Strictly assigned cases only (assigned via `case_participants`).
  - `reviewer`: Matters/cases where member or participant.
- **Response**: `200 OK`
  ```json
  {
    "data": [
      {
        "id": "UUID",
        "matterId": "UUID",
        "caseNumber": "CR-2024-001",
        "courtName": "High Court of Bombay",
        "jurisdiction": "State of Maharashtra",
        "caseType": "Cyber Crime",
        "firNumber": "FIR-2024/098",
        "policeStation": "Cyber Cell BKC",
        "presidingJudgeId": "UUID",
        "presidingJudgeName": "Hon. Justice V. K. Sharma",
        "investigationOfficerId": "UUID",
        "investigationOfficerName": "Inspector Rajesh Kumar",
        "stage": "Investigation",
        "filingDate": "2024-03-15",
        "nextHearingDate": "2026-10-15T10:00:00.000Z",
        "createdAt": "ISO-8601",
        "updatedAt": "ISO-8601"
      }
    ],
    "total": 1
  }
  ```

### 1.2. Get Court Case Details
- **Endpoint**: `GET /api/cases/:id`
- **Authentication**: Required
- **Parameters**: `id` (UUID)
- **Response**: `200 OK` or `403 Forbidden` / `404 Not Found`

### 1.3. Create Court Case
- **Endpoint**: `POST /api/cases`
- **Authentication**: Required
- **Authorized Roles**: `workspace_admin`, authorized matter lead `attorney`.
- **Validation Rules**:
  - `caseNumber`: String (min 3, max 64, unique).
  - `matterId`: Valid UUID referencing an existing matter.
  - `courtName`: String (min 3, max 255).
  - `jurisdiction`: String (min 2, max 255).
  - `caseType`: String (min 2, max 64).
  - `stage`: Enum (`Filing`, `Investigation`, `Pre-Trial`, `Trial`, `Evidence Hearing`, `Judgement`, `Appeal`, `Closed`). Default: `Investigation`.
  - `filingDate`: Optional `YYYY-MM-DD`.
  - `nextHearingDate`: Optional ISO-8601 datetime string.
  - `presidingJudgeId`: Optional UUID (target must have system role `judge` or `workspace_admin`).
- **Enforcements**:
  - **1:1 Matter-to-Case**: Exactly one court case per matter is permitted. Returns `409 Conflict` if the matter is already linked.
  - **Unique Case Number**: Duplicate case numbers rejected with `409 Conflict`.
- **Response**: `201 Created`
- **Audit & Notification**: Generates `matter_created` audit event and sends notification to assigned presiding judge.

### 1.4. Update Court Case
- **Endpoint**: `PATCH /api/cases/:id`
- **Authentication**: Required
- **Authorized Roles**: `workspace_admin`, assigned presiding `judge`, or authorized matter lead `attorney`.
- **Allowlisted Fields**: `courtName`, `jurisdiction`, `caseType`, `firNumber`, `policeStation`, `presidingJudgeId`, `investigationOfficerId`, `stage`, `filingDate`, `nextHearingDate`.
- **Security Boundaries**:
  - `matterId` and `caseNumber` **cannot** be altered via PATCH.
  - `presidingJudgeId` and `investigationOfficerId` reassignments are restricted to `workspace_admin` or lead attorney.
- **Response**: `200 OK`
- **Audit & Notification**:
  - Stage changes generate `case_stage_changed` audit logs and notify case participants.
  - Hearing date changes generate `hearing_date_changed` audit logs and notify participants.

---

## 2. Case Participants API

Mounted at `/api/cases/:id/participants`. Managed by `caseParticipantService.ts`.

### 2.1. List Participants for a Case
- **Endpoint**: `GET /api/cases/:id/participants`
- **Authentication**: Required
- **Allowed Roles**: All participants authorized to view the parent court case. Victims cannot enumerate participants of cases they do not belong to.
- **Response**: `200 OK`
  ```json
  {
    "data": [
      {
        "id": "UUID",
        "courtCaseId": "UUID",
        "matterId": "UUID",
        "userId": "UUID",
        "userName": "Dr. Amitav Sen",
        "userRole": "forensic_team",
        "participantRole": "forensic_examiner",
        "isPrimary": true,
        "assignedBy": "UUID",
        "assignedAt": "ISO-8601"
      }
    ],
    "total": 1
  }
  ```

### 2.2. Add Participant to Case
- **Endpoint**: `POST /api/cases/:id/participants`
- **Authentication**: Required
- **Authorized Roles**: `workspace_admin`, presiding `judge`, or authorized lead `attorney`.
- **Supported Participant Roles**:
  - `judge` (Target must have system role `judge` or `workspace_admin`)
  - `prosecutor` (Target must have system role `attorney`)
  - `defense_lawyer` (Target must have system role `attorney`)
  - `victim` (Target must have system role `victim`)
  - `forensic_examiner` (Target must have system role `forensic_team`)
  - `investigating_officer` (Target must be active authorized user)
  - `auditor` (Target must have system role `auditor`)
- **Security & Integrity Constraints**:
  - **Victim Restriction**: Victims **cannot** assign themselves or other users (enforces `403 Forbidden`).
  - **Forensic Team Restriction**: Forensic team members **cannot** self-assign to arbitrary cases.
  - **No Duplicate Assignments**: Users cannot hold duplicate assignments in the same case (returns `409 Conflict`).
  - **Synchronization Trigger**: Database trigger `trg_sync_case_participant` synchronizes non-victim participants into `matter_members` with appropriate access level (`lead`, `contributor`, `viewer`).
  - **Victim Isolation**: The database trigger **explicitly excludes** the `victim` role from `matter_members`, ensuring victims never obtain blanket document visibility.
- **Response**: `201 Created`

### 2.3. Update Participant Role
- **Endpoint**: `PATCH /api/cases/:id/participants/:participantId`
- **Authentication**: Required
- **Authorized Roles**: `workspace_admin`, presiding `judge`, or lead `attorney`.
- **Validation**: Role compatibility verified if role changes.
- **Response**: `200 OK`

### 2.4. Remove Participant
- **Endpoint**: `DELETE /api/cases/:id/participants/:participantId`
- **Authentication**: Required
- **Authorized Roles**: `workspace_admin`, presiding `judge`, or lead `attorney`.
- **Response**: `204 No Content`

---

## 3. Digital Forensic Reports API

Mounted at `/api/forensic-reports` and `/api/cases/:id/forensic-reports`. Managed by `forensicService.ts`.

### 3.1. List Forensic Reports for Case
- **Endpoint**: `GET /api/cases/:id/forensic-reports`
- **Authentication**: Required
- **Victim Isolation**: **STRICT DENIAL**. Victims receive `403 Forbidden` under all circumstances. Digital forensic reports are strictly withheld from protected victims.
- **Response**: `200 OK`

### 3.2. Get Forensic Report by ID
- **Endpoint**: `GET /api/forensic-reports/:id`
- **Authentication**: Required
- **Victim Isolation**: **STRICT DENIAL**. Returns `403 Forbidden` if user role is `victim`.
- **Response**: `200 OK`

### 3.3. Create Draft Forensic Report
- **Endpoint**: `POST /api/cases/:id/forensic-reports`
- **Authentication**: Required
- **Authorized Roles**: `forensic_team` or `workspace_admin`.
- **Request Body**:
  - `documentId`: Optional UUID (must belong to the case matter).
  - `labName`: String (min 2, max 128).
  - `deviceType`: String (min 2, max 64).
  - `deviceMakeModel`: String (min 2, max 128).
  - `deviceSerialNumber`: String (min 2, max 128).
  - `extractionTool`: String (min 2, max 64).
  - `extractionToolVersion`: String (min 1, max 32).
  - `acquisitionSha256`: 64-hex SHA-256 hash.
  - `verificationSha256`: 64-hex SHA-256 hash.
  - `hashesMatch`: Boolean.
  - `intakeCondition`: String (min 2).
  - `findingsSummary`: String (min 2).
  - `section65bCertified`: Boolean (default `false`).
- **Response**: `201 Created` (`isFinalized: false`)

### 3.4. Update Draft Report
- **Endpoint**: `PATCH /api/forensic-reports/:id`
- **Authentication**: Required
- **Authorized Roles**: Assigned `forensic_team` examiner or `workspace_admin`.
- **Immutability Enforcement**: Finalized reports **cannot be modified**. Returns `400 Bad Request` if `is_finalized == true`.
- **Response**: `200 OK`

### 3.5. Finalize Forensic Report (Section 65B Certification)
- **Endpoint**: `POST /api/forensic-reports/:id/finalize`
- **Authentication**: Required
- **Authorized Roles**: Assigned examiner or `workspace_admin`.
- **Strict Cryptographic Verification**:
  1. Both `acquisition_sha256` and `verification_sha256` must be present and 64 hexadecimal characters.
  2. `acquisition_sha256.toLowerCase() === verification_sha256.toLowerCase()`.
  3. `hashes_match` flag must be `true`.
  4. If `document_id` is set, verifies that the document belongs to the case matter.
  5. If any verification fails, returns `400 Bad Request`.
- **State Transition**:
  - Sets `is_finalized = true`.
  - Sets `finalized_at = timezone('utc', now())`.
  - Sets `section_65b_certified = true`.
  - Generates immutable Section 65B audit trail entry.
  - Dispatches notifications to presiding judge and lead counsel.
- **Database Trigger Enforcement**: `trg_protect_forensic_reports` permanently freezes finalized records from SQL UPDATE and DELETE.

---

## 4. Evidence Chain of Custody API

Mounted at `/api/documents/:documentId/custody`. Managed by `custodyService.ts`.

### 4.1. View Custody Ledger History
- **Endpoint**: `GET /api/documents/:documentId/custody`
- **Authentication**: Required
- **Victim Isolation**: **STRICT DENIAL**. Victims receive `403 Forbidden`.
- **Matter Access Verification**: User must have access to the matter containing the document (or be `workspace_admin`/`auditor`).
- **Response**: `200 OK`
  ```json
  {
    "data": [
      {
        "id": "UUID",
        "documentId": "UUID",
        "documentTitle": "Seized_HardDrive_Image.raw",
        "matterId": "UUID",
        "courtCaseId": "UUID",
        "releasingPartyId": "UUID",
        "releasingPartyName": "Inspector Rajesh Kumar",
        "receivingPartyId": "UUID",
        "receivingPartyName": "Dr. Amitav Sen",
        "transferType": "LAB_ANALYSIS",
        "purpose": "Forensic bit-stream acquisition & hash verification",
        "securitySealNumber": "SEAL-IND-2024-9981",
        "sealIntact": true,
        "sha256Verified": true,
        "transferTimestamp": "ISO-8601",
        "notes": "Evidence bag seal intact upon receipt at CFSL New Delhi",
        "createdAt": "ISO-8601"
      }
    ],
    "total": 1
  }
  ```

### 4.2. Record Custody Transfer
- **Endpoint**: `POST /api/documents/:documentId/custody`
- **Authentication**: Required
- **Supported Transfer Types**: `INTAKE`, `LAB_ANALYSIS`, `COURT_SUBMISSION`, `VAULT_STORAGE`, `RELEASE`.
- **Validation**:
  - Document must exist.
  - User must be authorized for the matter (auditors and victims rejected with `403 Forbidden`).
  - `releasing_party_id`: Automatically set to verified `req.user.id`. Only `workspace_admin` may specify a different releasing officer. Non-admins supplying an arbitrary releasing party receive `403 Forbidden`.
  - `receiving_party_id`: Must reference an active user profile.
  - `securitySealNumber`: Non-empty string.
- **Response**: `201 Created`
- **Audit & Notification**: Inserts audit log and sends notification alert to the receiving party.

### 4.3. Append-Only Ledger Guarantees
- **No UPDATE Endpoint**: `PATCH` and `PUT` return `404 Not Found`.
- **No DELETE Endpoint**: `DELETE` returns `404 Not Found`.
- **Database Trigger**: `trg_protect_evidence_custody` permanently aborts any SQL `UPDATE` or `DELETE` with an exception.

---

## 5. Notifications API

Mounted at `/api/notifications`. Managed by `notificationService.ts`.

### 5.1. List Authenticated User's Notifications
- **Endpoint**: `GET /api/notifications`
- **Authentication**: Required
- **Query Parameters**:
  - `unread`: `true` to filter unread only.
  - `limit`: Integer (default 50).
- **Ownership Scoping**: Users can **only** query notifications where `recipient_id === auth.uid()`. Cross-user inspection is impossible.
- **Response**: `200 OK`
  ```json
  {
    "data": [
      {
        "id": "UUID",
        "recipientId": "UUID",
        "courtCaseId": "UUID",
        "title": "Evidence Custody Transferred",
        "message": "You have received digital evidence custody for...",
        "type": "custody_transferred",
        "isRead": false,
        "createdAt": "ISO-8601"
      }
    ],
    "total": 1,
    "unreadCount": 1
  }
  ```

### 5.2. Mark Notification as Read
- **Endpoint**: `PATCH /api/notifications/:id/read`
- **Authentication**: Required
- **Ownership Verification**: Users can only mark their own notification as read. Attempting to mark another user's notification returns `403 Forbidden`.
- **Allowlisted Update**: Only `is_read: true` is updated. Notification titles, messages, recipients, and types cannot be altered.
- **Response**: `200 OK`

### 5.3. Public Creation Restricted
- Notification generation is reserved for verified internal backend events:
  - `hearing_scheduled` (on case hearing date update)
  - `evidence_submitted` (on forensic report finalization)
  - `custody_transferred` (on evidence custody handover)
  - `case_status_updated` (on case stage change or participant addition)
- No public client POST endpoint is exposed.

---

## 6. HTTP Status Codes

| Code | Meaning | Usage Scenario |
|---|---|---|
| `200` | OK | Successful GET or PATCH operation |
| `201` | Created | Successful creation of case, participant, report, or custody record |
| `204` | No Content | Successful participant deletion |
| `400` | Bad Request | Zod validation failure, Section 65B hash mismatch, or invalid input |
| `401` | Unauthorized | Missing, invalid, or expired Supabase Auth token |
| `403` | Forbidden | Role violation, ethical wall block, victim barrier, or unauthorized access |
| `404` | Not Found | Target court case, document, report, or notification not found |
| `409` | Conflict | Duplicate case number, matter already has a case, or duplicate participant |
| `500` | Server Error | Unhandled runtime exception (stack omitted in production) |
