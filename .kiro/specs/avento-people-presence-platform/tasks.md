# Tasks

## Task 1: Project Setup and Database Schema

- [x] 1.1 Initialize project with Node.js/TypeScript backend, configure linting, and set up project structure (src/routes, src/models, src/services, src/middleware, src/utils)
- [x] 1.2 Set up PostgreSQL database connection with a migration tool (e.g., Knex or Prisma)
- [x] 1.3 Create migration for Organization table with id (UUID), name, industry_module, metadata (JSONB), created_at, updated_at
- [x] 1.4 Create migration for User table with id (UUID), organization_id (FK), email, password_hash, role (enum: Admin, Stakeholder), created_at, updated_at
- [x] 1.5 Create migration for Person table with id (UUID), organization_id (FK), name, contact_info (JSONB), metadata (JSONB), is_active (boolean), created_at, updated_at
- [x] 1.6 Create migration for Group table with id (UUID), organization_id (FK), name, description, created_at, updated_at
- [x] 1.7 Create migration for Person_Group join table with person_id (FK), group_id (FK), assigned_at, and composite primary key
- [x] 1.8 Create migration for Stakeholder table with id (UUID), organization_id (FK), user_id (FK), name, communication_channels (JSONB), created_at, updated_at
- [x] 1.9 Create migration for Person_Stakeholder join table with person_id (FK), stakeholder_id (FK), relationship (string), and composite primary key
- [x] 1.10 Create migration for Attendance_Record table with id (UUID), organization_id (FK), person_id (FK), date, time, presence_status (enum), recorded_by (FK), created_at, updated_at, and UNIQUE constraint on (person_id, date)
- [x] 1.11 Create migration for Leave_Request table with id (UUID), organization_id (FK), person_id (FK), requested_by (FK), start_date, end_date, reason, status (enum), reviewed_by (FK nullable), review_comment (nullable), created_at, updated_at
- [x] 1.12 Create migration for Notification table with id (UUID), organization_id (FK), stakeholder_id (FK), type, title, body, channel_used, delivery_status (enum), sent_at (nullable), created_at, updated_at
- [x] 1.13 Create migration for Announcement table with id (UUID), organization_id (FK), title, body, target_type (enum), target_ids (UUID[]), scheduled_at (nullable), published_at (nullable), created_by (FK), created_at, updated_at

## Task 2: Authentication and Authorization

- [x] 2.1 Implement User model with password hashing (bcrypt, salt rounds >= 12)
- [x] 2.2 Create POST /api/auth/login endpoint that validates credentials and returns a JWT containing user_id, organization_id, and role
- [x] 2.3 Create POST /api/auth/refresh endpoint for token renewal
- [x] 2.4 Create POST /api/auth/logout endpoint for session invalidation
- [x] 2.5 Implement JWT authentication middleware that extracts organization_id and user info from token and attaches to request context
- [x] 2.6 Implement role-based authorization middleware that checks user role against endpoint requirements and returns 403 for unauthorized access
- [x] 2.7 Implement tenant isolation middleware that injects organization_id filter into all database queries
- [x] 2.8 Add rate limiting on authentication endpoints

## Task 3: Organization Management

- [x] 3.1 Create GET /api/organization endpoint to retrieve current organization details (Admin only)
- [x] 3.2 Create PUT /api/organization endpoint to update organization settings and metadata (Admin only)

## Task 4: Person Management

- [x] 4.1 Create POST /api/persons endpoint to register a new Person with name, contact_info, groups, and stakeholders (Admin only)
- [x] 4.2 Create GET /api/persons endpoint with filtering by group and active status, with pagination (Admin only)
- [x] 4.3 Create GET /api/persons/:id endpoint to retrieve Person details including groups and stakeholders (Admin only)
- [x] 4.4 Create PUT /api/persons/:id endpoint to update Person details (Admin only)
- [x] 4.5 Create PATCH /api/persons/:id/deactivate endpoint to set is_active=false and exclude from tracking (Admin only)

## Task 5: Group Management

- [x] 5.1 Create POST /api/groups endpoint to create a Group with name and description (Admin only)
- [x] 5.2 Create GET /api/groups endpoint to list all Groups with member counts (Admin only)
- [x] 5.3 Create GET /api/groups/:id endpoint to get Group details with member list (Admin only)
- [x] 5.4 Create PUT /api/groups/:id endpoint to update Group details (Admin only)
- [x] 5.5 Create POST /api/groups/:id/members endpoint to add Persons to a Group (Admin only)
- [x] 5.6 Create DELETE /api/groups/:id/members/:personId endpoint to remove a Person from a Group (Admin only)

## Task 6: Attendance Recording

- [x] 6.1 Create POST /api/attendance endpoint to record attendance for a single Person with presence_status, enforcing UNIQUE(person_id, date) via upsert (Admin only)
- [x] 6.2 Create POST /api/attendance/bulk endpoint to record attendance for all active Persons in a Group (Admin only)
- [x] 6.3 Create GET /api/attendance endpoint to query attendance records with filters for date range, person_id, and group_id, with pagination (Admin only)
- [x] 6.4 Create GET /api/attendance/:personId/today endpoint to get today's attendance status for a Person
- [x] 6.5 Implement attendance recording service that stores recorded_by user and submission timestamp

## Task 7: Notification Service

- [x] 7.1 Set up an asynchronous message queue (e.g., Bull/BullMQ with Redis) for notification processing
- [x] 7.2 Implement notification creation service that creates Notification records and enqueues delivery jobs
- [x] 7.3 Implement notification delivery worker that attempts delivery on highest-priority Communication_Channel and falls back on failure
- [x] 7.4 Integrate notification trigger into attendance recording — when Absent or Late is recorded, enqueue notifications for all associated Stakeholders within 5 minutes
- [x] 7.5 Implement push notification channel adapter (e.g., Firebase Cloud Messaging)
- [x] 7.6 Implement SMS channel adapter
- [x] 7.7 Implement WhatsApp channel adapter
- [x] 7.8 Implement email channel adapter
- [x] 7.9 Implement undeliverable notification logging and surface in Admin dashboard
- [x] 7.10 Create GET /api/notifications endpoint to list notifications for current user with pagination
- [x] 7.11 Create GET /api/notifications/unread-count endpoint

## Task 8: Leave Request Management

- [x] 8.1 Create POST /api/leave-requests endpoint for Stakeholders to submit a Leave_Request with validation (end_date >= start_date)
- [x] 8.2 Create GET /api/leave-requests endpoint — Admin sees all for the organization, Stakeholder sees only their own
- [x] 8.3 Create GET /api/leave-requests/:id endpoint to view leave request details
- [x] 8.4 Create PUT /api/leave-requests/:id/approve endpoint that updates status to Approved and sends confirmation Notification (Admin only)
- [x] 8.5 Create PUT /api/leave-requests/:id/reject endpoint that updates status to Rejected with reason and sends rejection Notification (Admin only)
- [x] 8.6 Implement auto-attendance service — when a Leave_Request is approved, create Attendance_Records with status On_Leave for each date in the range

## Task 9: Announcements

- [x] 9.1 Create POST /api/announcements endpoint to create an Announcement with title, body, target_type, and target_ids (Admin only)
- [x] 9.2 Create GET /api/announcements endpoint to list Announcements with pagination (Admin only)
- [x] 9.3 Create PUT /api/announcements/:id endpoint to update an Announcement before publication (Admin only)
- [x] 9.4 Create POST /api/announcements/:id/publish endpoint to publish immediately and send Notifications to targeted Stakeholders (Admin only)
- [x] 9.5 Implement scheduled announcement publishing — process announcements with scheduled_at in the past that are not yet published

## Task 10: Attendance Reports

- [x] 10.1 Implement report generation service that calculates total_days, days_present, days_absent, days_late, days_on_leave, and attendance_percentage for a given date range, group, or person
- [x] 10.2 Create GET /api/reports/attendance endpoint that returns report data (Admin only)
- [x] 10.3 Implement per-Person breakdown when report is generated for a Group
- [x] 10.4 Create GET /api/reports/attendance/export endpoint with format parameter (pdf, csv) (Admin only)
- [x] 10.5 Implement PDF report generation
- [x] 10.6 Implement CSV report generation

## Task 11: Parent Portal

- [x] 11.1 Create GET /api/portal/persons endpoint to list all Persons associated with the authenticated Stakeholder, including current Presence_Status
- [x] 11.2 Create GET /api/portal/persons/:id/attendance endpoint to get attendance history for an associated Person with date range filtering
- [x] 11.3 Create GET /api/portal/notifications endpoint to list Stakeholder's notifications in reverse chronological order with pagination
- [x] 11.4 Create GET /api/portal/announcements endpoint to list Announcements relevant to the Stakeholder's associated Persons and Groups

## Task 12: Communication Channel Configuration

- [x] 12.1 Create API endpoints for Admin to configure Organization-level communication channel settings (credentials for SMS, WhatsApp, email providers)
- [x] 12.2 Implement channel credential validation on save
- [x] 12.3 Create API endpoints for managing Stakeholder communication channel preferences (priority ordering)
- [x] 12.4 Implement channel priority resolution in notification delivery service

## Task 13: Frontend - Admin Dashboard

- [x] 13.1 Set up frontend project (React/Next.js or similar SPA framework) with routing and authentication state management
- [x] 13.2 Build login page with JWT token handling
- [x] 13.3 Build Admin dashboard home page with summary widgets (today's attendance count, pending leave requests, recent notifications)
- [x] 13.4 Build Person management pages (list, create, edit, deactivate)
- [x] 13.5 Build Group management pages (list, create, edit, manage members)
- [x] 13.6 Build Attendance recording page with Group selection and bulk marking
- [x] 13.7 Build Leave Request management page (list, approve, reject)
- [x] 13.8 Build Announcement management pages (create, list, publish, schedule)
- [x] 13.9 Build Reports page with date range selection, group/person filter, and export buttons
- [x] 13.10 Build Communication Channel configuration page
- [x] 13.11 Build undeliverable notifications dashboard view

## Task 14: Frontend - Parent Portal

- [x] 14.1 Build Parent Portal login page
- [x] 14.2 Build Parent Portal home page showing associated Persons with current attendance status
- [x] 14.3 Build attendance history view for each associated Person
- [x] 14.4 Build Leave Request submission form and request history view
- [x] 14.5 Build Notifications list page
- [x] 14.6 Build Announcements list page
