# Avento — People Presence Platform
## Complete Product Guide

---

## 1. What is Avento?

Avento is a **People Presence Platform** — a cloud-based SaaS application that gives organizations real-time visibility into who is present, absent, late, or on leave.

Think of it as an **operating system for attendance**. Schools know instantly when a child is absent. Parents get notified within minutes. Administrators generate reports in seconds. Leave requests flow through approvals without paperwork.

### The Core Problem We Solve

Schools today manage attendance using:
- Paper registers (lost, delayed, no parent visibility)
- WhatsApp groups (chaotic, no structure, no reports)
- Excel sheets (manual, error-prone, no real-time alerts)
- Expensive ERP systems (overbuilt, complicated, costly)

**Avento replaces all of this** with a simple, focused platform that does one thing extremely well: **tracks people presence and communicates it instantly.**

---

## 2. Technology Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| **Node.js** | Server runtime — fast, scalable, handles thousands of concurrent connections |
| **TypeScript** | Type-safe JavaScript — catches bugs before they reach users |
| **Express.js** | Web framework — handles HTTP requests and API routing |
| **PostgreSQL** | Database — enterprise-grade, handles millions of records reliably |
| **Knex.js** | Database migrations and query builder — clean SQL generation |
| **BullMQ + Redis** | Message queue — processes notifications asynchronously without blocking |
| **JWT (JSON Web Tokens)** | Authentication — secure, stateless session management |
| **bcrypt** | Password security — industry-standard hashing with salt |
| **PDFKit** | Report generation — creates downloadable PDF attendance reports |

### Frontend
| Technology | Purpose |
|-----------|---------|
| **React 18** | UI framework — fast, component-based interface |
| **TypeScript** | Type safety for frontend code |
| **Vite** | Build tool — instant hot reload during development, optimized production builds |
| **React Router** | Client-side navigation — instant page transitions |
| **Axios** | HTTP client — communicates with backend API |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| **Railway** (recommended) | Cloud hosting for backend, database, and Redis |
| **Vercel** (recommended) | Frontend hosting with global CDN |
| **PostgreSQL (cloud)** | Managed database with automatic backups |
| **Redis (cloud)** | Message queue for notification processing |

### Architecture Highlights
- **Multi-tenant**: One platform serves multiple schools, with complete data isolation
- **Role-based access**: Admin (school staff) and Stakeholder (parents) with different permissions
- **RESTful API**: Clean, predictable API endpoints following industry standards
- **Async notifications**: Messages are queued and delivered without slowing down the main application
- **Generic data model**: Built to support schools, hospitals, factories — not hardcoded for one industry

---

## 3. How to Use the Application

### For School Administrators

#### Initial Setup (One-time)
1. Log in with your Admin credentials
2. Go to **Groups** → Create classes (e.g., "Class 1A", "Class 2B", "Class 3C")
3. Go to **Persons** → Add students (name, contact info)
4. Assign students to their classes via Groups
5. Go to **Channels** → Configure notification channels (SMS, WhatsApp, Email, Push)

#### Daily Workflow
1. **Mark Attendance** (every morning)
   - Go to **Attendance** page
   - Select the class (group)
   - Select today's date
   - Mark each student: Present / Absent / Late
   - Click "Submit Attendance"
   - Parents of absent/late students are automatically notified

2. **Manage Leave Requests**
   - Go to **Leave Requests** page
   - Review pending requests from parents
   - Approve or Reject (with reason)
   - Approved leaves automatically mark students as "On Leave" for those dates

3. **Send Announcements**
   - Go to **Announcements** page
   - Create announcement (holiday notice, event, etc.)
   - Target: entire school, specific class, or specific students
   - Publish immediately or schedule for later

4. **Generate Reports**
   - Go to **Reports** page
   - Select date range and class/student
   - View attendance percentage, days present/absent/late
   - Export as PDF or CSV for sharing with management

### For Parents (Parent Portal)

1. **View Attendance**
   - See today's status for each child (Present/Absent/Late/On Leave)
   - View full attendance history with date range filters

2. **Get Notifications**
   - Receive instant alerts when child is marked absent or late
   - Notifications via push, SMS, WhatsApp, or email (based on preference)

3. **Submit Leave Requests**
   - Fill in start date, end date, and reason
   - Track request status (Pending → Approved/Rejected)

4. **Read Announcements**
   - View school announcements relevant to their child's class

---

## 4. How It Helps End Users

### For School Administrators
| Pain Point | How Avento Solves It |
|-----------|---------------------|
| Spending 30+ minutes on paper registers daily | Mark attendance for entire class in under 2 minutes |
| No way to know who's absent until end of day | Real-time dashboard shows attendance status instantly |
| Parents calling to ask about child's attendance | Parents check the portal themselves — zero phone calls |
| Manual report generation taking hours | One-click reports with PDF/CSV export |
| Lost paper leave applications | Digital leave workflow with approval history |
| No way to broadcast urgent messages | Instant announcements to targeted groups |

### For Parents
| Pain Point | How Avento Solves It |
|-----------|---------------------|
| Not knowing if child reached school safely | Instant notification when child is marked present/absent |
| Calling school to report leave | Submit leave request from phone in 30 seconds |
| Missing important school notices | All announcements delivered directly via preferred channel |
| No visibility into attendance patterns | Full attendance history with percentage calculations |

### For School Management
| Pain Point | How Avento Solves It |
|-----------|---------------------|
| No data for decision-making | Detailed analytics: which classes have low attendance, trends over time |
| Compliance and record-keeping | Digital audit trail for all attendance records |
| Staff spending time on admin work | Automation frees teachers to focus on teaching |
| Parent communication overhead | System handles all routine communication automatically |

---

## 5. Sales Strategy — Communicating with Schools

### Who to Talk To
1. **School Principal / Director** — Decision maker
2. **School Administrator / Office Manager** — Daily user, feels the pain most
3. **IT Coordinator** (if they have one) — Technical validation

### Opening Conversation

**Don't start with technology. Start with their problem.**

> "How are you currently tracking student attendance? And how quickly do parents know if their child is absent?"

Most schools will say: paper registers, WhatsApp groups, or manual SMS. The delay is usually hours or even days.

### Key Talking Points

1. **Safety Angle** (works best with principals)
   > "If a student doesn't show up because they bunked or something happened on the way, how quickly does the parent know? With Avento, parents know within 5 minutes of attendance being marked."

2. **Time Savings** (works best with administrators)
   > "Your teachers spend 15-20 minutes every morning on registers, then someone manually enters it into a computer. With Avento, one person marks attendance for 40 students in under 2 minutes, and everything is automatic from there."

3. **Parent Satisfaction** (works best with management)
   > "Schools that communicate proactively with parents have 3x higher retention. Avento makes parents feel connected without any extra effort from your staff."

4. **Cost Comparison** (when they mention budget)
   > "You're probably spending ₹X on SMS for communications already. Avento replaces that AND gives you attendance tracking, leave management, reports — all for one subscription."

### Handling Objections

| Objection | Response |
|-----------|----------|
| "We already use an ERP" | "ERPs are great for fees and academics. Avento focuses solely on presence and communication — it's simpler, faster, and your staff actually uses it daily." |
| "Our teachers aren't tech-savvy" | "It's a simple dropdown: select class, mark present/absent. If they can use WhatsApp, they can use Avento. We provide training." |
| "Parents won't download another app" | "We deliver via WhatsApp, SMS, and email — whatever parents already use. No app download required." |
| "We're a small school, we don't need this" | "Small schools benefit most — you don't have admin staff to waste on manual work. Avento automates it all for less than ₹5 per student per month." |
| "What about data security?" | "Each school's data is completely isolated. We use bank-grade encryption for passwords and secure cloud hosting with automatic backups." |

### Pricing Model (Suggested)

| Plan | Price | Includes |
|------|-------|----------|
| **Starter** | ₹3/student/month | Attendance + Parent Portal + Notifications (email only) |
| **Growth** | ₹5/student/month | Everything + SMS/WhatsApp + Leave Management + Reports |
| **Premium** | ₹8/student/month | Everything + Priority Support + Custom Branding |

**Minimum billing:** ₹500/month (covers up to ~100 students on Starter)

### Demo Script (15 minutes)

1. **Show the login** (30 sec) — "Here's how your staff logs in."
2. **Mark attendance** (2 min) — "Select class, mark students, done. Takes 30 seconds."
3. **Show parent notification** (1 min) — "See? Parent got notified instantly."
4. **Parent portal** (2 min) — "This is what parents see. Their child's status, history, leave requests."
5. **Leave request flow** (2 min) — "Parent submits from their phone. You approve with one click. Dates are automatically marked."
6. **Reports** (2 min) — "Select date range, export PDF. Ready for your management meeting."
7. **Announcements** (1 min) — "Type a message, select who gets it, publish. Done."
8. **Q&A** (5 min)

### Follow-Up Strategy
1. **Day 0**: Demo + collect requirements
2. **Day 1**: Send pricing proposal via email
3. **Day 3**: Follow up call — "Any questions from your team?"
4. **Day 7**: Offer 14-day free trial with their real data
5. **Day 21**: Check in during trial — "How's it going? Need help?"
6. **Day 30**: Close the deal or understand blockers

---

## 6. Competitive Advantages

| Feature | Avento | Typical School ERP | WhatsApp Groups |
|---------|--------|-------------------|-----------------|
| Attendance marking time | 30 seconds | 2-5 minutes | Not tracked |
| Parent notification speed | Under 5 minutes | Hours/Never | Manual, inconsistent |
| Leave management | Digital workflow | Paper or basic | Informal messages |
| Reports | One-click PDF/CSV | Complex, training needed | None |
| Setup time | 1 hour | Weeks/Months | Instant but chaotic |
| Cost per student/month | ₹3-8 | ₹15-50 | Free but hidden costs |
| Multi-channel notifications | ✅ Push, SMS, WhatsApp, Email | ❌ Usually email only | ❌ WhatsApp only |
| Data isolation | ✅ Complete | ✅ | ❌ None |

---

## 7. Future Roadmap (Phase 2+)

These features are NOT in the current MVP but planned:

- **Homework Tracking** — Teachers assign, parents see, students submit
- **Fee Due Notifications** — Automated payment reminders
- **Biometric/QR Integration** — Auto attendance via devices
- **Mobile App** — Native iOS/Android app for parents
- **Analytics Dashboard** — Trends, predictions, anomaly detection
- **Multi-language Support** — Hindi, regional languages
- **Hospital/Security/Workforce Modules** — Same platform, different industries

---

## 8. Quick Reference

### Login Credentials (Demo)
| Role | Email | Password | Org ID |
|------|-------|----------|--------|
| Admin | admin@demo.school | Admin@123456 | 7225b114-6da6-4b22-9019-d8cdb4d417a6 |
| Parent | parent@demo.school | Parent@123456 | 7225b114-6da6-4b22-9019-d8cdb4d417a6 |

### API Endpoints Summary
| Area | Base Path | Methods |
|------|-----------|---------|
| Auth | /api/auth | POST login, refresh, logout |
| Organization | /api/organization | GET, PUT |
| Persons | /api/persons | GET, POST, PUT, PATCH |
| Groups | /api/groups | GET, POST, PUT, DELETE |
| Attendance | /api/attendance | GET, POST (single + bulk) |
| Leave Requests | /api/leave-requests | GET, POST, PUT (approve/reject) |
| Announcements | /api/announcements | GET, POST, PUT, POST (publish) |
| Reports | /api/reports | GET (data + export) |
| Notifications | /api/notifications | GET (list + unread count + undeliverable) |
| Parent Portal | /api/portal | GET (persons, attendance, notifications, announcements) |
| Channels | /api/channels | GET, PUT (org + stakeholder) |

### Running Locally
```bash
# Backend (port 3000)
node -e "require('ts-node').register(); require('./src/index.ts')"

# Frontend (port 5173/5174)
cd frontend && npx vite
```

---

*Document Version: 1.0 | Last Updated: June 2026 | Avento Platform MVP*
