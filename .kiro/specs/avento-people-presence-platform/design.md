# Design Document

## Introduction

This document describes the technical design for the Avento People Presence Platform MVP (School Module). The architecture follows a layered approach with a generic data model that supports multiple industry modules through configuration rather than schema changes.

## Architecture Overview

The platform uses a modern web application architecture:

- **Frontend**: Single Page Application (SPA) for Admin Dashboard and Parent Portal
- **Backend**: RESTful API server with role-based access control
- **Database**: Relational database with tenant isolation via Organization ID foreign keys
- **Notification Service**: Asynchronous message queue for multi-channel notification delivery
- **Authentication**: JWT-based authentication with organization-scoped tokens

## Data Model

### Core Entities

```
Organization
├── id (UUID, PK)
├── name (string)
├── industry_module (string: "school", "hospital", "security", etc.)
├── metadata (JSONB - industry-specific config)
├── created_at (timestamp)
└── updated_at (timestamp)

Person
├── id (UUID, PK)
├── organization_id (UUID, FK → Organization)
├── name (string)
├── contact_info (JSONB)
├── metadata (JSONB - industry-specific attributes)
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)

Group
├── id (UUID, PK)
├── organization_id (UUID, FK → Organization)
├── name (string)
├── description (string)
├── created_at (timestamp)
└── updated_at (timestamp)

Person_Group (join table)
├── person_id (UUID, FK → Person)
├── group_id (UUID, FK → Group)
└── assigned_at (timestamp)

Stakeholder
├── id (UUID, PK)
├── organization_id (UUID, FK → Organization)
├── user_id (UUID, FK → User)
├── name (string)
├── communication_channels (JSONB - ordered list of channels with config)
├── created_at (timestamp)
└── updated_at (timestamp)

Person_Stakeholder (join table)
├── person_id (UUID, FK → Person)
├── stakeholder_id (UUID, FK → Stakeholder)
└── relationship (string: "parent", "guardian", "manager")

Attendance_Record
├── id (UUID, PK)
├── organization_id (UUID, FK → Organization)
├── person_id (UUID, FK → Person)
├── date (date)
├── time (timestamp)
├── presence_status (enum: Present, Absent, Late, On_Leave)
├── recorded_by (UUID, FK → User)
├── created_at (timestamp)
└── updated_at (timestamp)
└── UNIQUE(person_id, date)

Leave_Request
├── id (UUID, PK)
├── organization_id (UUID, FK → Organization)
├── person_id (UUID, FK → Person)
├── requested_by (UUID, FK → Stakeholder)
├── start_date (date)
├── end_date (date)
├── reason (text)
├── status (enum: Pending, Approved, Rejected)
├── reviewed_by (UUID, FK → User, nullable)
├── review_comment (text, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

Notification
├── id (UUID, PK)
├── organization_id (UUID, FK → Organization)
├── stakeholder_id (UUID, FK → Stakeholder)
├── type (string: "absence", "late", "leave_approved", "leave_rejected", "announcement")
├── title (string)
├── body (text)
├── channel_used (string)
├── delivery_status (enum: Pending, Sent, Failed)
├── sent_at (timestamp, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

Announcement
├── id (UUID, PK)
├── organization_id (UUID, FK → Organization)
├── title (string)
├── body (text)
├── target_type (enum: Organization, Group, Person)
├── target_ids (UUID[] - list of group or person IDs)
├── scheduled_at (timestamp, nullable)
├── published_at (timestamp, nullable)
├── created_by (UUID, FK → User)
├── created_at (timestamp)
└── updated_at (timestamp)

User
├── id (UUID, PK)
├── organization_id (UUID, FK → Organization)
├── email (string)
├── password_hash (string)
├── role (enum: Admin, Stakeholder)
├── created_at (timestamp)
└── updated_at (timestamp)
```

## API Design

### Authentication Endpoints
- `POST /api/auth/login` — Authenticate and receive JWT token
- `POST /api/auth/refresh` — Refresh expired token
- `POST /api/auth/logout` — Invalidate session

### Organization Endpoints (Admin)
- `GET /api/organization` — Get current organization details
- `PUT /api/organization` — Update organization settings

### Person Endpoints (Admin)
- `POST /api/persons` — Create a person
- `GET /api/persons` — List persons (supports filtering by group, active status)
- `GET /api/persons/:id` — Get person details
- `PUT /api/persons/:id` — Update person
- `PATCH /api/persons/:id/deactivate` — Deactivate person

### Group Endpoints (Admin)
- `POST /api/groups` — Create a group
- `GET /api/groups` — List groups
- `GET /api/groups/:id` — Get group details with members
- `PUT /api/groups/:id` — Update group
- `POST /api/groups/:id/members` — Add persons to group
- `DELETE /api/groups/:id/members/:personId` — Remove person from group

### Attendance Endpoints (Admin)
- `POST /api/attendance` — Record attendance for a person
- `POST /api/attendance/bulk` — Record attendance for a group
- `GET /api/attendance` — Query attendance records (by date range, person, group)
- `GET /api/attendance/:personId/today` — Get today's status for a person

### Leave Request Endpoints
- `POST /api/leave-requests` — Submit leave request (Stakeholder)
- `GET /api/leave-requests` — List leave requests (Admin: all; Stakeholder: own)
- `GET /api/leave-requests/:id` — Get leave request details
- `PUT /api/leave-requests/:id/approve` — Approve leave request (Admin)
- `PUT /api/leave-requests/:id/reject` — Reject leave request with reason (Admin)

### Notification Endpoints
- `GET /api/notifications` — List notifications for current user
- `GET /api/notifications/unread-count` — Get unread notification count

### Announcement Endpoints (Admin)
- `POST /api/announcements` — Create announcement
- `GET /api/announcements` — List announcements
- `PUT /api/announcements/:id` — Update announcement
- `POST /api/announcements/:id/publish` — Publish immediately

### Report Endpoints (Admin)
- `GET /api/reports/attendance` — Generate attendance report (params: date range, group, person)
- `GET /api/reports/attendance/export` — Export report (params: format=pdf|csv)

### Parent Portal Endpoints (Stakeholder)
- `GET /api/portal/persons` — List associated persons with current status
- `GET /api/portal/persons/:id/attendance` — Get attendance history for a person
- `GET /api/portal/notifications` — List stakeholder notifications
- `GET /api/portal/announcements` — List relevant announcements

## Notification Flow

```
Attendance Recorded (Absent/Late)
    │
    ▼
Notification Service (async via message queue)
    │
    ├── Look up Person's Stakeholders
    ├── For each Stakeholder:
    │     ├── Get priority-ordered Communication_Channels
    │     ├── Attempt delivery on highest-priority channel
    │     ├── If failed → try next channel
    │     └── If all channels fail → log as undeliverable
    │
    └── Store Notification record with delivery status
```

## Leave Request Flow

```
Stakeholder submits Leave_Request
    │
    ▼
Validate (end_date >= start_date)
    │
    ▼
Store with status = Pending
    │
    ▼
Admin reviews
    ├── Approve → status = Approved
    │     ├── Send confirmation Notification to Stakeholder
    │     └── Auto-create Attendance_Records (On_Leave) for date range
    │
    └── Reject → status = Rejected
          └── Send rejection Notification with reason to Stakeholder
```

## Security Design

- All API endpoints require valid JWT token (except `/api/auth/login` and health-check)
- JWT payload includes: user_id, organization_id, role
- Every database query includes `WHERE organization_id = <token.organization_id>`
- Role-based middleware validates Admin vs Stakeholder access per endpoint
- Password storage uses bcrypt with salt rounds ≥ 12
- Rate limiting on authentication endpoints

## Report Calculation

Attendance percentage formula:
```
attendance_percentage = ((days_present + days_late) / (total_days - days_on_leave)) * 100
```

Where:
- `total_days` = number of weekdays in the date range
- `days_present` = count of Attendance_Records with status = Present
- `days_late` = count of Attendance_Records with status = Late
- `days_on_leave` = count of Attendance_Records with status = On_Leave

## Communication Channel Priority

Each Stakeholder has an ordered list of communication channels:
```json
{
  "channels": [
    { "type": "push_notification", "config": { "device_token": "..." }, "priority": 1 },
    { "type": "whatsapp", "config": { "phone": "+91..." }, "priority": 2 },
    { "type": "sms", "config": { "phone": "+91..." }, "priority": 3 },
    { "type": "email", "config": { "address": "..." }, "priority": 4 }
  ]
}
```

The notification service attempts delivery in priority order, falling back to the next channel on failure.

## Tenant Isolation Strategy

- Row-Level Security: All tables include `organization_id` column
- API middleware extracts `organization_id` from JWT and injects into all queries
- Database indexes include `organization_id` as prefix for efficient per-tenant queries
- No cross-tenant joins or queries permitted at the application layer

## Correctness Properties

### Property 1: Tenant Data Isolation
- FOR ALL API requests, the response SHALL contain only data where `organization_id` matches the authenticated user's organization
- This is an invariant that must hold across all endpoints

### Property 2: Attendance Record Uniqueness
- FOR ALL attendance submissions for the same Person and same date, the system SHALL maintain exactly one Attendance_Record (upsert behavior)
- This is an idempotence property

### Property 3: Leave Request Date Validation
- FOR ALL Leave_Requests, `start_date <= end_date` must hold
- This is an invariant enforced at submission time

### Property 4: Notification Delivery Completeness
- FOR ALL Attendance_Records with status Absent or Late, a Notification SHALL be created for each Stakeholder associated with the Person
- This is a metamorphic property (count of notifications = count of stakeholders × count of absence/late events)

### Property 5: Attendance Percentage Calculation
- FOR ALL generated Reports, `attendance_percentage = ((days_present + days_late) / (total_days - days_on_leave)) * 100`
- This can be validated via model-based testing against a simple reference implementation

### Property 6: Leave Auto-Attendance
- FOR ALL approved Leave_Requests spanning N days, exactly N Attendance_Records with status On_Leave SHALL be created
- This is a metamorphic property (count relationship)

### Property 7: Role-Based Access Enforcement
- FOR ALL API requests by a Stakeholder role to Admin-only endpoints, the response status code SHALL be 403
- This is an error condition property
