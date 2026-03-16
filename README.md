# Invoice Tracker

A comprehensive Next.js-based invoice management system with role-based access control (RBAC) and multi-tier approval workflow for processing vendor invoices.

## Table of Contents
## database credentials

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [User Roles & Permissions](#user-roles--permissions)
- [Invoice Workflow](#invoice-workflow)
- [API Endpoints](#api-endpoints)
- [Database Models](#database-models)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Development](#development)
- [Security](#security)
- [Contributing](#contributing)

---

## Overview

The Invoice Tracker is a web application built with Next.js that enables organizations to manage invoices through a structured approval process. It supports multiple user roles with granular permissions, ensuring proper governance and auditability throughout the invoice lifecycle.

**Key Technologies:**
- Next.js 15.1.7
- MongoDB with Mongoose ODM
- React 19.0.0
- Tesseract.js and Mindee (OCR processing)
- jose (JWT authentication)
- DaisyUI and Tailwind CSS

---

## Features

### Workflow & Approval System
- **Multi-tier approval chain**: Admin → Divisional Head → Department Head → Project Manager → Vendor
- **Legacy finance approval** (backward compatible): Project Manager → Finance User
- **Role-based workflow stages** with mandatory assignments
- **Audit trail** tracking all actions across workflow stages
- **State machine validation** for permitted transitions

### User Management
- **Role-based access control** (RBAC)
- **User hierarchy** with admin-managed delegation
- **Project assignment** for Project Managers
- **Vendor-to-invoice** linkage tracking
- **Session-based authentication** with JWT tokens

### Invoice Processing
- **OCR document parsing** (Tesseract.js, Mindee)
- **PDF and Excel upload** support
- **Line-item rate validation** with matching logic
- **Document metadata** extraction and storage
- **File preview** capabilities

### Analytics & Monitoring
- **Dashboard metrics** by role
- **Work queue management** for pending approvals
- **Audit log viewer** (admin only)
- **Health check endpoints**
- **Rate card management**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Invoice Tracker Architecture            │
└─────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   Vendor     │  ← Submits invoices
    �──────────────┘
            │
            ▼
    ┌──────────────┐
    │ Project PM   │  ← Reviews assigned projects
    �──────────────┘
            │
            ▼
    ┌──────────────┐
    │ Dept Head    │  ← First FU-level approval
    �──────────────┘
            │
            ▼
    ┌──────────────┐
    │ Div Head     │  ← Final FU-level approval
    ┌──────────────┐

    (Legacy Flow: PM → Finance User)

    ┌──────────────┐
    │    Admin     │  ← Full system access, audit logs
    ───────────────┘
```

### Application Layers

- **Presentation Layer**: React components with DaisyUI styling
- **API Layer**: Role-specific route handlers (`app/api/*/route.js`)
- **Business Logic Layer**: Workflow validation, RBAC checks
- **Data Access Layer**: Mongoose models, database interface
- **Infrastructure Layer**: MongoDB, file storage, authentication

---

## Requirements

### System Requirements
- Node.js 18.x or higher
- MongoDB 4.4 or higher (Atlas or local)
- Minimum 2GB RAM memory
- Modern browser with JavaScript enabled

### Development Requirements
```json
{
  "dependencies": {
    "next": "15.1.7",
    "react": "19.0.0",
    "mongoose": "8.10.1",
    "tesseract.js": "^7.0.0",
    "mindee": "^5.0.0-alpha2"
  }
}

```

---

## Installation

### Prerequisites

1. **Install Node.js**:
```bash
# Verify Node.js version
node --version  # Should be 18.x or higher
```

2. **Install MongoDB**:
   - Option A: Use MongoDB Atlas (recommended for production)
   - Option B: Install local MongoDB instance
   - Option C: Use Docker container

### Steps

```bash
# 1. Clone or navigate to project directory
cd "Invoice Tracker"

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Note: .env.example not present in repo - create manually
```

---

## Configuration

### Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Database Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/invoice-tracker?retryWrites=true&w=majority

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_VERSION=1.0.0

# Authentication (JWT)
# Note: These should base64-encoded and securely managed
JWT_SECRET=your_secure_secret_key_here

# CORS (optional, for API routes)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Optional Environment Variables

```bash
# OCR Configuration (Tesseract.js)
# Mindee API Key (for OCR enhancement)
MINDEE_API_KEY=your_mindee_api_key

# File Upload Settings
MAX_UPLOAD_SIZE=10485760  # 10MB in bytes

# Development Settings
NODE_ENV=development
```

### Security Headers Configuration

The application includes security headers via [`middleware.js`](middleware.js:1):
- Content-Security-Policy
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy

---

## Project Structure

```
Invoice Tracker/
├── app/                        # Next.js App Router
│   ├── admin/                  # Admin dashboard and pages
│   ├── analytics/              # Analytics endpoints
│   ├── api/                    # API routes
│   │   ├── admin/              # Admin operations
│   │   ├── auth/               # Authentication endpoints
│   │   ├── audit/              # Audit logs
│   │   ├── invoices/           # Invoice CRUD operations
│   │   ├── pm/                 # Project Manager endpoints
│   │   ├── dept-head/          # Department Head endpoints
│   │   ├── div-head/           # Divisional Head endpoints
│   │   ├── finance/            # Finance User endpoints
│   │   └── vendors/            # Vendor endpoints
│   ├── dashboard/              # Dashboard router
│   ├── pm/                     # PM interface
│   ├── finance/                # Finance User interface
│   ├── dept-head/              # Department Head interface
│   ├── div-head/               # Divisional Head interface
│   └── vendors/                # Vendor interface
├── components/                 # Reusable React components
├── constants/                  # Configuration constants
│   └── roles.js               # Role definitions and permissions
├── context/                    # React contexts
├── lib/                        # Library/utility functions
│   ├── db.js                  # Database interface (1037 lines)
│   ├── mongodb.js             # MongoDB connection pooling
│   ├── invoice-workflow.js    # Workflow state machine
│   └── auth.js                # Authentication utilities
├── models/                     # Mongoose schemas
│   ├── Invoice.js             # Invoice model
│   ├── User.js                # User model
│   ├── Project.js             # Project model
│   └── Vendor.js              # Vendor model
├── middleware.js               # Next.js middleware (auth, security)
├── scripts/                    # Utility scripts
├── tests/                      # Test files
├── __tests__/                  # Jest test directory
├── .env                        # Environment variables
├── .gitignore                  # Git ignore patterns
├── jest.config.mjs            # Jest configuration
├── next.config.mjs            # Next.js configuration
├── package.json               # Project dependencies
└── README.md                  # This file
```

---

## User Roles & Permissions

### Role Hierarchy

```
Admin (Full access)
├─ Divisional Head (Final approval layer)
│   └─ Department Head (Mid approval layer)
│       └─ Project Manager (Project-level approval)
│           └─ Vendor (Submit invoices)

Finance User (Legacy - backward compatible)
└─ Project Manager
```

### Role Definitions

| Role | ID | Description | Permissions |
|------|----|-------------|-------------|
| **Admin** | `Admin` | Full system access | All operations, audit logs, configuration |
| **Divisional Head** | `Divisional Head` | Final FU-later approval | View invoices, approve/reject, rate cards, messages |
| **Department Head** | `Department Head` | Mid FU-level approval | View invoices, approve/reject, rate cards, messages |
| **Project Manager** | `PM` | Project-level approval | Project invoices, rate cards, messages |
| **Finance User** | `Finance User` | Legacy operational role | Invoice review (deprecated workflow) |
| **Vendor** | `Vendor` | Invoice submitter | Submit invoices, view own invoices, rate cards |

### Permission Matrix

| Action | Admin | Div Head | Dept Head | PM | Finance User | Vendor |
|--------|-------|-----------|-----------|-----|--------------|--------|
| Configure system | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve invoices | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Finalize payment | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View all invoices | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View own invoices | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Submit invoices | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| View audit logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage rate cards | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Send messages | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

### Menu Access Control

Defined in [`constants/roles.js`](constants/roles.js:96):

```javascript
export const MENU_PERMISSIONS = {
    'Dashboard': ['Admin', 'PM', 'Department Head', 'Divisional Head', 'Vendor'],
    'Approvals': ['Admin'],
    'PM Approval Queue': ['PM'],
    'Dept Head Approval Queue': ['Department Head'],
    'Div Head Approval Queue': ['Divisional Head'],
    'Messages': ['Admin', 'PM', 'Vendor', 'Department Head', 'Divisional Head'],
    'User Management': ['Admin'],
    'Audit Logs': ['Admin'],
    'Rate Cards': ['Admin', 'PM', 'Department Head', 'Divisional Head', 'Vendor'],
    'Configuration': ['Admin'],
    'Hierarchy': ['Admin'],
    'Re-check Requests': ['Vendor']
};
```

---

## Invoice Workflow

### Workflow State Machine

The invoice workflow follows a state machine pattern defined in [`lib/invoice-workflow.js`](lib/invoice-workflow.js:1).

#### Status States

| Status | Description | Next Stage |
|--------|-------------|------------|
| `Submitted` | Initial submission | Pending PM Approval |
| `Pending PM Approval` | Awaiting PM review | Pending Dept Head Review |
| `Pending Dept Head Review` | Awaiting Dept Head review | Pending Div Head Review |
| `Pending Div Head Review` | Awaiting Div Head review | Div Head Approved |
| `Div Head Approved` | Final approved state | None (terminal) |
| `Pending Finance Review` | Legacy: Awaiting Finance review | Finance Approved |
| `Finance Approved` | Legacy: Finance approved | None (terminal) |
| `More Info Needed` | Additional info requested | Back to review stage |
| `PM Rejected` | PM rejected | None (terminal) |
| `Dept Head Rejected` | Dept Head rejected | None (terminal) |
| `Div Head Rejected` | Div Head rejected | None (terminal) |
| `Finance Rejected` | Finance rejected | None (terminal) |

#### Current Workflow (Two-tier)

```
Submitted → Pending PM Approval → Pending Dept Head Review → Pending Div Head Review → Div Head Approved
                                                          ↓
                                                      Div Head Rejected

Vendor may send additional info:
More Info Needed → (varies based on who requested)
```

#### Legacy Workflow (Finance User)

```
Submitted → Pending PM Approval → Pending Finance Review → Finance Approved
                                                          ↓
                                                      Finance Rejected
```

### Workflow Transition Rules

Permitted transitions are validated by [`validateTransition()`](lib/invoice-workflow.js:270):

```javascript
// Example: PM approving an invoice
validateTransition(
    'Pending PM Approval',     // currentStatus
    'Pending Dept Head Review', // newStatus
    'PM'                       // role
)
// Returns: { allowed: true }
```

### Role-based Transition Permissions

Each role has restricted permissions for workflow transitions:

| Role | Allowed From | Allowed To |
|------|-------------|-----------|
| **Vendor** | `More Info Needed` | Back to appropriate review stage |
| **PM** | `Pending PM Approval`, `Submitted` | Approve/reject/reject to Dept Head or Finance |
| **Department Head** | `Pending Dept Head Review` | Approve/reject to Div Head |
| **Divisional Head** | `Pending Div Head Review` | Final approve/reject |
| **Finance User** | `Pending Finance Review` | Approve/reject (legacy) |
| **Admin** | Any status | Any transition |

### Workflow Functions

Key functions in [`lib/invoice-workflow.js`](lib/invoice-workflow.js:1):

- [`validateTransition()`](lib/invoice-workflow.js:270) - Check if transition is permitted
- [`getAllowedTransitions()`](lib/invoice-workflow.js:316) - Get allowed transitions for role
- [`determineInfoReturnDestination()`](lib/invoice-workflow.js:337) - Determine where to route after info submission
- [`isTerminalStatus()`](lib/invoice-workflow.js:370) - Check if workflow is complete
- [`getNextStage()`](lib/invoice-workflow.js:384) - Get next expected stage
- [`generateAuditMessage()`](lib/invoice-workflow.js:399) - Generate audit log messages

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | Login user | No |
| POST | `/api/auth/logout` | Logout user | No |
| POST | `/api/auth/signup` | Register new user | No |
| POST | `/api/auth/otp/request` | Request OTP | No |
| POST | `/api/auth/otp/verify` | Verify OTP | No |
| POST | `/api/auth/password/reset` | Reset password | No |
| GET | `/api/auth/me` | Get current user | Yes |

### Invoices

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| GET | `/api/invoices` | List invoices (filtered by role) | Any |
| GET | `/api/invoices/[id]` | Get invoice details | Any |
| POST | `/api/invoices` | Create invoice | Vendor |
| PUT | `/api/invoices/[id]` | Update invoice | Owner or approvers |
| GET | `/api/invoices/[id]/file` | Get invoice file | Any |
| GET | `/api/invoices/[id]/preview` | Preview invoice | Any |
| POST | `/api/invoices/[id]/workflow` | Update workflow status | Approved roles |
| POST | `/api/invoices/export` | Export invoices | Admin |

### Project Manager Endpoints

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| GET | `/api/pm/dashboard` | PM dashboard data | PM |
| POST | `/api/pm/approve/[id]` | Approve/reject invoice | PM |
| POST | `/api/pm/delegate` | Delegate project | PM |

### Department Head Endpoints

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| GET | `/api/dept-head/dashboard` | Dept Head dashboard | Dept Head |
| POST | `/api/dept-head/approve/[id]` | Approve/reject invoice | Dept Head |

### Divisional Head Endpoints

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| GET | `/api/div-head/dashboard` | Div Head dashboard | Div Head |
| POST | `/api/div-head/approve/[id]` | Approve/reject invoice | Div Head |

### Finance User Endpoints

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| GET | `/api/finance/dashboard` | Finance dashboard | Finance User |
| POST | `/api/finance/approve/[id]` | Approve/reject invoice | Finance User |

### Vendor Endpoints

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| GET | `/api/vendors/dashboard` | Vendor dashboard | Vendor |
| POST | `/api/vendors` | Create vendor | Admin |

### Admin Endpoints

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| GET | `/api/admin/dashboard` | Admin dashboard | Admin |
| POST | `/api/admin/approve/[id]` | Approve/reject invoice | Admin |
| GET | `/api/admin/users` | List users | Admin |
| POST | `/api/admin/users` | Create user | Admin |
| PUT | `/api/admin/users/[id]` | Update user | Admin |
| DELETE | `/api/admin/users/[id]` | Delete user | Admin |
| GET | `/api/admin/projects` | List projects | Admin |
| POST | `/api/admin/projects` | Create project | Admin |
| GET | `/api/admin/ratecards` | List rate cards | Admin |
| POST | `/api/admin/ratecards` | Create rate card | Admin |
| PUT | `/api/admin/ratecards/[id]` | Update rate card | Admin |
| GET | `/api/admin/messages` | Messages | Admin |
| POST | `/api/admin/hierarchy` | Hierarchy management | Admin |
| POST | `/api/admin/backfill-vendor-ids` | Backfill vendor IDs | Admin |

### System & Utility

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/health` | Health check | No |
| GET | `/api/audit` | Audit logs | Yes |
| GET | `/api/config` | Configuration | No |
| POST | `/api/integrations/test` | Test integrations | Yes |
| POST | `/api/notifications/send-reminders` | Send notifications | Admin |
| POST | `/api/debug/seed` | Seed database | No |
| GET | `/api/debug/hierarchy-check` | Check hierarchy | No |

### Documents

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/documents` | List documents | Yes |
| GET | `/api/documents/[id]/file` | Download document | Yes |
| GET | `/api/documents/[id]/preview` | Preview document | Yes |

### Projects

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/projects` | List projects | Yes |
| GET | `/api/projects/[id]` | Get project | Yes |
| GET | `/api/projects/[id]/pms` | Get project PMs | Yes |

### Users

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users` | List users | Yes |
| GET | `/api/users/[id]` | Get user | Yes |
| GET | `/api/users/by-role` | Get users by role | Yes |

---

## Database Models

### Invoice Model

Location: [`models/Invoice.js`](models/Invoice.js:1)

**Fields:**
- `id` (String, required): Unique invoice identifier
- `vendorName` (String, required): Name of vendor
- `submittedByUserId` (String): User ID of submitter
- `vendorId` (String): Vendor record ID
- `invoiceNumber` (String): Invoice number
- `date` (String): Invoice date
- `invoiceDate` (String): Separate invoice date field
- `billingMonth` (String): Billing month (YYYY-MM format)
- `amount` (Number): Invoice amount
- `basicAmount` (Number): Amount before taxes
- `totalAmount` (Number): Total amount including taxes
- `taxType` (Enum): CGST_SGST, IGST, or empty
- `hsnCode` (String): HSN code
- `status` (Enum): Workflow status (13 options)
- `originatorRole` (Enum): Role that initiated invoice
- `category` (String): Invoice category
- `poNumber` (String): Purchase order number
- `project` (String): Associated project
- `lineItems` (Array): Line items with rate validation
- `assignedPM` (String): PM user ID
- `assignedFinanceUser` (String): Finance user ID (legacy)
- `assignedDeptHead` (String): Department Head user ID
- `assignedDivHead` (String): Divisional Head user ID
- `financeApproval` (ApprovalSchema): Finance approval record
- `pmApproval` (ApprovalSchema): PM approval record
- `deptHeadApproval` (ApprovalSchema): Dept Head approval record
- `divHeadApproval` (ApprovalSchema): Div Head approval record
- `adminApproval` (ApprovalSchema): Admin approval record
- `hilReview` (HILReviewSchema): Hand Invoice Line review
- `documents` (Array): Attached documents
- `auditTrail` (Array): Workflow audit logs

**Indexes:**
- Status, assignedPM, assignedDeptHead, assignedDivHead, project, submittedByUserId, approval statuses, audit trail timestamp

**ApprovalSchema:**
```javascript
{
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED',
  approvedBy: String,
  approvedByName: String,
  approvedByRole: String,
  approvedAt: Date,
  notes: String
}
```

### User Model

Location: [`models/User.js`](models/User.js:1)

**Fields:**
- `id` (String, required): Unique user identifier
- `name` (String, required): Display name
- `email` (String, required, unique): User email
- `passwordHash` (String, required): Hashed password
- `role` (String, required): User role
- `assignedProjects` (Array[String]): Projects assigned (for PMs)
- `vendorId` (String): Vendor ID (for vendors)
- `isActive` (Boolean, default: true): User active status
- `permissions` (Array[String]): Granular permissions override
- `lastLogin` (Date): Last login timestamp
- `profileImage` (String): Profile image URL
- `department` (String): User department
- `managedBy` (String): Manager user ID
- `delegatedTo` (String): Delegate user ID
- `delegationExpiresAt` (Date): Delegation expiration

**Indexes:**
- email (unique), role + isActive, managedBy

### Project Model

Location: [`models/Project.js`](models/Project.js:1)

**Fields:**
- `id` (String, required): Unique project identifier
- `name` (String, required): Project name
- `ringiNumber` (String): RINGI number
- `description` (String): Project description
- `status` (Enum): ACTIVE, COMPLETED, ARCHIVED
- `assignedPMs` (Array[String]): Assigned PM user IDs
- `vendorIds` (Array[String]): Associated vendor IDs
- `billingMonth` (String): Project billing month

**Indexes:**
- assignedPMs, status, ringiNumber

---

## Running the Application

### Development Mode

```bash
# Start development server
npm run dev

# Application available at: http://localhost:3000
```

### Production Mode

```bash
# Build application
npm run build

# Start production server
npm start

# Application available at: http://localhost:3000
```

### Database Seeding

```bash
# Seed users into database
npm run seed:users
```

### Development Commands

```bash
# Lint code
npm run lint

# Run tests (if configured)
npm run test

# Interactive shell (if configured)
npm run shell
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npx jest path/to/test.spec.js

# Run with coverage
npx jest --coverage
```

### Test Configuration

Configuration in [`jest.config.mjs`](jest.config.mjs:1):
- Environment: Node.js
- Transform: babel-jest for JS/JSX files
- Module mapping: `@/*` to `<rootDir>/$1`

### Writing Tests

Location: `tests/` and `__tests__/`

Example structure:
```
tests/
├── unit/
│   ├── workflow.test.js
│   ├── permissions.test.js
│   └── utils.test.js
└── integration/
    ├── api.test.js
    └── workflow.test.js
```

---

## Development

### Code Organization

- **Models**: Define data schemas in `models/`
- **API**: Route handlers in `app/api/*/route.js`
- **Components**: Reusable components in `components/`
- **Libraries**: Utility functions in `lib/`
- **Constants**: Configuration in `constants/`
- **Contexts**: React state in `context/`

### Common Tasks

#### Adding a new user role

1. Update [`constants/roles.js`](constants/roles.js:1):
   - Add to `ROLES` object
   - Add to `ROLES_LIST` if active
   - Add permissions to `MENU_PERMISSIONS`
   - Update `hasPermission()` function

2. Update [`lib/invoice-workflow.js`](lib/invoice-workflow.js:1):
   - Add workflow transitions if applicable
   - Add transition permissions

3. Create dashboard page in `app/{role}/dashboard/page.jsx`

#### Adding a new API endpoint

1. Create route file in `app/api/{endpoint}/route.js`
2. Implement CRUD operations
3. Add authentication checks
4. Add role-based access control
5. Update README documentation

### Debugging

### Viewing Logs

```bash
# Development logs appear in terminal
# Application logs available in console browser
```

### Database Connection Issues

Check [`lib/mongodb.js`](lib/mongodb.js:1) for connection configuration:
- Verify `MONGODB_URI` in `.env.local`
- Check MongoDB server accessibility
- Review connection timeout settings

### Workflow Validation Issues

Use [`validateTransition()`](lib/invoice-workflow.js:270) to debug:
```javascript
const result = validateTransition(
    currentStatus,
    newStatus,
    userRole
);
console.log(result); // { allowed: true/false, reason: string }
```

---

## Security

### Authentication Flow

1. User logs in via `/api/auth/login`
2. JWT token generated and encrypted
3. Token stored in `session` cookie
4. [`middleware.js`](middleware.js:1) decrypts and validates token
5. Role header (`x-user-role`) injected for internal API use
6. Invalid sessions redirect to `/login`

### Security Headers

Configured in [`middleware.js`](middleware.js:1):
- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy

### CORS Configuration

Configured for all `/api/*` routes in [`middleware.js`](middleware.js:1):
```javascript
Access-Control-Allow-Origin: process.env.NEXT_PUBLIC_APP_URL
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, x-user-role
```

### RBAC Enforcement

- All API routes check user role via `x-user-role` header
- [`hasPermission()`](constants/roles.js:117) validates actions
- Workflow transitions validated by [`validateTransition()`](lib/invoice-workflow.js:270)

### Best Practices

- Never commit `.env` files
- Rotate JWT secrets regularly
- Use strong password hashing
- Enable HTTPS in production
- Regularly update dependencies
- Implement rate limiting for API routes

---

## Contributing

### Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create development branch: `git checkout -b feature/your-feature`

### Code Style

- Use ES6+ features
- Follow existing code patterns
- Use meaningful variable and function names
- Comment complex logic
- Add tests for new features

### Commit Guidelines

Use conventional commits:
```
feat: add new role-based workflow
fix: correct invoice status transition
docs: update README with new endpoints
refactor: simplify workflow validation
test: add unit tests for RBAC
```

### Pull Request Process

1. Update README if applicable
2. Add/update tests
3. Ensure all tests pass
4. Run linter: `npm run lint`
5. Create pull request with description

### Development Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
git add .
git commit -m "feat: implement new feature"

# Pull and rebase
git pull origin main --rebase

# Push and create PR
git push origin feature/new-feature
```

---

## License

TBD - Contact project maintainers for license information.

## Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Contact project maintainers
- Review documentation and code comments

---

## Quick Reference

### Common URLs

- **Dashboard**: `/dashboard`
- **Admin Dashboard**: `/admin/dashboard`
- **PM Dashboard**: `/pm/dashboard`
- **Dept Head Dashboard**: `/dept-head/dashboard`
- **Div Head Dashboard**: `/div-head/dashboard`
- **Finance Dashboard**: `/finance/dashboard`
- **Vendor Dashboard**: `/vendors`
- **Login**: `/login`
- **Signup**: `/signup`

### Environment Variables

```bash
MONGODB_URI=                      # Required
NEXT_PUBLIC_APP_URL=              # Required
NEXT_PUBLIC_APP_VERSION=          # Required (default: 1.0.0)
JWT_SECRET=                       # Required (implicit via auth lib)
MINDEE_API_KEY=                   # Optional (OCR enhancement)
```

### Database Connection

Database connection handled by [`lib/mongodb.js`](lib/mongodb.js:1):
- Connection pooling configured
- IPv4 preferred for stability
- 15-second timeouts
- Max pool size: 10 connections

### Workflow Quick Reference

```
New Flow:
Submitted → PM Approval → Dept Head Review → Div Head Review → Done

Legacy Flow:
Submitted → PM Approval → Finance Review → Done

Checkpoints:
- PM can assign anyone for review
- Dept Head must approve before Div Head
- Info needed returns to appropriate stage
- Admin can override workflow
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Current | Initial release with two-tier workflow and RBAC |

---

For more detailed information, refer to individual file documentation and inline comments throughout the codebase. done