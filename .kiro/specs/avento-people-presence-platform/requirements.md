# Requirements Document

## Introduction

Avento is a People Presence Platform — a multi-tenant SaaS application that provides real-time visibility into people attendance, communication, and operational status for attendance-driven organizations. The platform is built around generic entities (Organization, Person, Group, Attendance, Notification) that can be configured per industry vertical.

The MVP focuses on the **School Module**, where Person = Student, while maintaining a generic platform architecture underneath. The MVP scope includes Attendance tracking, Notifications, Parent Portal, Leave Requests, and Reports.

## Glossary

- **Platform**: The Avento People Presence Platform SaaS application
- **Organization**: A tenant entity representing a school, hospital, or other attendance-driven organization
- **Person**: A generic entity representing an individual tracked by the platform (configured per industry — e.g., Student in School Module)
- **Group**: A logical grouping of Persons within an Organization (e.g., Class, Section, Department)
- **Attendance_Record**: A timestamped record capturing presence status for a Person
- **Presence_Status**: One of: Present, Absent, Late, On_Leave, Checked_In, Checked_Out
- **Stakeholder**: A party interested in a Person's presence status (e.g., Parent, Manager, Supervisor)
- **Leave_Request**: A formal request by or on behalf of a Person to be absent for a specified period
- **Notification**: A message sent to a Stakeholder via a communication channel
- **Communication_Channel**: A delivery mechanism for Notifications (Push Notification, SMS, WhatsApp, Email)
- **Parent_Portal**: A dedicated interface for Stakeholders (parents in School Module) to view attendance, receive notifications, and submit leave requests
- **Announcement**: A broadcast message sent from an Organization to a set of Persons or Stakeholders
- **Admin**: An authorized user who manages Organization settings, Groups, Persons, and Attendance
- **Report**: A generated summary of attendance data over a configurable time period

## Requirements

### Requirement 1: Multi-Tenant Organization Management

**User Story:** As a platform operator, I want each organization to have isolated data and configuration, so that multiple organizations can use the platform without data leakage.

#### Acceptance Criteria

1. THE Platform SHALL isolate all data by Organization such that no API request returns data belonging to a different Organization
2. WHEN an Organization is created, THE Platform SHALL provision a unique tenant identifier for that Organization
3. THE Platform SHALL associate every Person, Group, Attendance_Record, Leave_Request, Notification, and Announcement with exactly one Organization
4. WHEN a user authenticates, THE Platform SHALL scope all subsequent data access to the Organization the user belongs to

### Requirement 2: Person Management

**User Story:** As an Admin, I want to register and manage Persons within my Organization, so that I can track their attendance and communicate with their Stakeholders.

#### Acceptance Criteria

1. WHEN an Admin creates a Person, THE Platform SHALL store the Person's name, contact information, assigned Groups, and associated Stakeholders
2. THE Platform SHALL allow an Admin to assign one or more Groups to a Person
3. THE Platform SHALL allow an Admin to associate one or more Stakeholders with a Person
4. WHEN an Admin updates a Person's details, THE Platform SHALL reflect the changes immediately in all subsequent queries
5. WHEN an Admin deactivates a Person, THE Platform SHALL exclude that Person from attendance tracking and notifications

### Requirement 3: Group Management

**User Story:** As an Admin, I want to organize Persons into Groups, so that I can manage attendance and communication at a group level.

#### Acceptance Criteria

1. WHEN an Admin creates a Group, THE Platform SHALL store the Group name, description, and associated Organization
2. THE Platform SHALL allow a Person to belong to one or more Groups simultaneously
3. WHEN an Admin marks attendance for a Group, THE Platform SHALL create Attendance_Records for all active Persons in that Group
4. THE Platform SHALL allow an Admin to send Announcements to all Persons and Stakeholders within a Group

### Requirement 4: Attendance Recording

**User Story:** As an Admin, I want to record attendance for Persons, so that the Organization has an accurate presence record.

#### Acceptance Criteria

1. WHEN an Admin submits attendance for a Person, THE Platform SHALL create an Attendance_Record with the Person identifier, date, time, and Presence_Status
2. THE Platform SHALL accept the following Presence_Status values: Present, Absent, Late, On_Leave
3. WHEN attendance is recorded for a Person already marked for the same date, THE Platform SHALL update the existing Attendance_Record rather than creating a duplicate
4. WHEN an Admin submits bulk attendance for a Group, THE Platform SHALL create or update Attendance_Records for each Person in that Group
5. THE Platform SHALL record the Admin who submitted the Attendance_Record and the timestamp of submission

### Requirement 5: Absence and Late Notifications

**User Story:** As a Stakeholder, I want to be notified when a Person I am associated with is marked absent or late, so that I am informed in real time.

#### Acceptance Criteria

1. WHEN a Person's Presence_Status is recorded as Absent, THE Platform SHALL send a Notification to all Stakeholders associated with that Person within 5 minutes
2. WHEN a Person's Presence_Status is recorded as Late, THE Platform SHALL send a Notification to all Stakeholders associated with that Person within 5 minutes
3. THE Platform SHALL deliver Notifications via at least one configured Communication_Channel for each Stakeholder
4. WHEN a Notification delivery fails on one Communication_Channel, THE Platform SHALL attempt delivery on the next configured Communication_Channel for that Stakeholder
5. THE Platform SHALL include the Person's name, Presence_Status, date, and time in every absence or late Notification

### Requirement 6: Leave Request Management

**User Story:** As a Stakeholder, I want to submit a leave request on behalf of a Person, so that the absence is pre-approved and recorded.

#### Acceptance Criteria

1. WHEN a Stakeholder submits a Leave_Request, THE Platform SHALL store the Person identifier, start date, end date, reason, and requesting Stakeholder
2. WHEN an Admin approves a Leave_Request, THE Platform SHALL update the Leave_Request status to Approved and send a confirmation Notification to the requesting Stakeholder
3. WHEN an Admin rejects a Leave_Request, THE Platform SHALL update the Leave_Request status to Rejected and send a rejection Notification to the requesting Stakeholder with the reason
4. WHILE a Leave_Request is in Approved status for a given date range, THE Platform SHALL automatically record the Person's Presence_Status as On_Leave for each date in that range
5. IF a Leave_Request is submitted with an end date before the start date, THEN THE Platform SHALL reject the submission and return a validation error

### Requirement 7: Parent Portal Access

**User Story:** As a Stakeholder (parent), I want a dedicated portal to view my associated Person's attendance, receive notifications, and manage leave requests, so that I have a single point of access.

#### Acceptance Criteria

1. WHEN a Stakeholder logs into the Parent_Portal, THE Platform SHALL display attendance history for all Persons associated with that Stakeholder
2. THE Parent_Portal SHALL display the current Presence_Status of each associated Person
3. THE Parent_Portal SHALL allow the Stakeholder to submit Leave_Requests for any associated Person
4. THE Parent_Portal SHALL display all Notifications sent to the Stakeholder in reverse chronological order
5. THE Parent_Portal SHALL display all Announcements relevant to the Stakeholder's associated Persons and Groups

### Requirement 8: Announcements

**User Story:** As an Admin, I want to broadcast announcements to Persons and Stakeholders, so that important information reaches the intended audience.

#### Acceptance Criteria

1. WHEN an Admin creates an Announcement, THE Platform SHALL store the title, body, target audience (Organization-wide, specific Groups, or specific Persons), and creation timestamp
2. WHEN an Announcement is published, THE Platform SHALL send a Notification to all targeted Stakeholders via their configured Communication_Channels
3. THE Platform SHALL make published Announcements available in the Parent_Portal for all targeted Stakeholders
4. THE Platform SHALL allow an Admin to schedule an Announcement for future publication at a specified date and time

### Requirement 9: Attendance Reports

**User Story:** As an Admin, I want to generate attendance reports, so that I can analyze presence patterns and share summaries with organizational leadership.

#### Acceptance Criteria

1. WHEN an Admin requests a Report, THE Platform SHALL generate the Report for a specified date range, Group, or Person
2. THE Platform SHALL include the following metrics in a Report: total days, days present, days absent, days late, days on leave, and attendance percentage
3. THE Platform SHALL allow an Admin to export a Report in PDF and CSV formats
4. WHEN a Report is generated for a Group, THE Platform SHALL include per-Person attendance summaries for all Persons in that Group
5. THE Platform SHALL calculate attendance percentage as (days present plus days late) divided by (total days minus days on leave) multiplied by 100

### Requirement 10: Generic Data Model Architecture

**User Story:** As a platform architect, I want the data model to use generic entities rather than school-specific entities, so that the platform can support multiple industry modules without schema changes.

#### Acceptance Criteria

1. THE Platform SHALL use Organization, Person, Group, Attendance_Record, Leave_Request, Notification, and Announcement as core entities in the data schema
2. THE Platform SHALL NOT use industry-specific entity names (Student, Teacher, Class, Section) in the database schema
3. THE Platform SHALL support industry-specific configuration through metadata and configuration records associated with an Organization
4. WHEN a new industry module is introduced, THE Platform SHALL support the module through configuration changes without requiring database schema migration for core entities
5. THE Platform SHALL store industry-specific attributes for a Person using a flexible metadata structure rather than fixed columns

### Requirement 11: User Authentication and Authorization

**User Story:** As any user, I want secure access to the platform with role-appropriate permissions, so that only authorized actions are performed.

#### Acceptance Criteria

1. THE Platform SHALL require authentication for all API endpoints except public health-check endpoints
2. WHEN a user authenticates successfully, THE Platform SHALL issue a session token scoped to the user's Organization
3. THE Platform SHALL enforce role-based access control with at minimum the following roles: Admin, Stakeholder
4. WHEN an unauthorized user attempts an Admin-only action, THE Platform SHALL reject the request and return a 403 Forbidden response
5. IF a session token expires, THEN THE Platform SHALL require re-authentication before granting access

### Requirement 12: Communication Channel Configuration

**User Story:** As an Admin, I want to configure communication channels for my Organization, so that Notifications reach Stakeholders through appropriate channels.

#### Acceptance Criteria

1. THE Platform SHALL support the following Communication_Channels: Push Notification, SMS, WhatsApp, Email
2. WHEN an Admin configures a Communication_Channel for the Organization, THE Platform SHALL validate the channel credentials before saving
3. THE Platform SHALL allow each Stakeholder to have one or more Communication_Channels configured with a priority order
4. WHEN sending a Notification, THE Platform SHALL use the highest-priority configured Communication_Channel for the target Stakeholder
5. IF no Communication_Channel is configured for a Stakeholder, THEN THE Platform SHALL log the undeliverable Notification and surface it in the Admin dashboard
