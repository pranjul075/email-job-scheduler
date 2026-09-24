# Email Dispatch Scheduler

A full-stack, distributed email scheduling and dispatch system built for high-throughput, rate-limited email campaigns. The application pairs a React frontend with an Express and TypeScript backend, using BullMQ and Redis for queueing and delayed execution, PostgreSQL (via Prisma) for persistent data storage, Elasticsearch for full-text search across messages, and Nodemailer with Ethereal SMTP for reliable test email delivery.

---

## Features

### Authentication
* **Email & Password Authentication:** Secure registration and login using `bcryptjs` password hashing with salted rounds.
* **JWT Session Management:** Stateless JSON Web Tokens issued upon login and stored in HTTP-only, secure cookies (`token`).
* **Google OAuth 2.0:** One-click Google Sign-In via standard OAuth redirect flow (`/api/auth/google`) and callback handling (`/api/auth/google/callback`). Automatically provisions user accounts and assigns a default sender profile upon first login.
* **Session Persistence & Route Guards:** Protected client-side routes in React with automatic session validation against `/api/auth/me`.

### Email Scheduling
* **Campaign & Batch Scheduling:** Schedule single or bulk email campaigns with individual recipient delivery staggered by configurable delay intervals.
* **Lead Parsing & Deduplication:** Upload lead lists via `.csv` or plain `.txt` files, or paste recipient emails directly. Automatically cleans, normalizes (lowercase, trimmed), filters invalid email formats using RFC-compliant regex, and deduplicates entries before submission.
* **Custom Scheduling Parameters:**
  * **Start Time:** Immediate dispatch or future datetime selection via interactive date/time picker or quick presets (e.g., Tomorrow morning/afternoon).
  * **Inter-Email Delay:** Configurable delay between successive recipient dispatches (minimum enforced via system setting, default 2 seconds).
  * **Hourly Limit:** Enforces a maximum number of emails dispatched per sender within a sliding 60-minute window (default 200 emails/hour).

### Queue & Background Processing
* **BullMQ & Redis Architecture:** Dedicated job queue (`email-dispatch-queue`) leveraging Redis for atomic scheduling, delayed jobs, and job persistence.
* **Standalone Worker Process:** Dedicated worker runner (`src/worker-runner.ts`) running decoupled from the HTTP API server.
* **Configurable Concurrency:** Parallel processing controlled via `WORKER_CONCURRENCY` (default: 5 concurrent jobs).
* **Delayed Job Dispatch:** Jobs calculated with millisecond-precision delays offset from campaign start times.
* **Deterministic Job Idempotency:** Each job receives a deterministic `jobId` derived from the database `idempotencyKey`, preventing duplicate job creation on network retries.
* **Controlled Job Retention:** Automatically limits completed and failed job histories in Redis (pruned to the most recent 1,000 jobs) to prevent memory bloat while preserving dashboard visibility.

### Rate Limiting
* **Two-Tier Rate Limiting Engine:**
  1. **Minimum Inter-Email Delay:** Tracks the last dispatch timestamp per sender in Redis (`email_last_sent:${senderId}`). If the minimum delay has not elapsed, the job is deferred and rescheduled after the remaining millisecond difference.
  2. **Hourly Sender Limits:** Tracks sliding hourly windows using an atomic Redis Lua script (`ATOMIC_HOURLY_INCR_LUA`) keyed by `email_rate:${senderId}:${hourWindowTimestamp}`.
* **Automatic Rescheduling:** When a sender exceeds their hourly quota, the worker moves the email record to `RATE_LIMITED` status in PostgreSQL and automatically creates a delayed BullMQ job scheduled for the start of the next hour window (`nextWindowDate`).
* **Distributed Concurrency Locks:** Uses Redis keys (`email_lock:${emailId}`) with NX (set if not exists) and TTL to guarantee that multiple concurrent workers never process the same scheduled email at the same time.

### Email Delivery
* **Ethereal SMTP Integration:** Fully configured using `nodemailer` to dispatch test emails through Ethereal Email (`smtp.ethereal.email:587`).
* **Custom or Auto-Generated Accounts:** Supports configured test credentials in `.env` or auto-creates test accounts on the fly via `nodemailer.createTestAccount()`.
* **Delivery Confirmation & Web Previews:** Captures SMTP `messageId` and generates public Ethereal web preview URLs (`etherealPreviewUrl`), which are saved in PostgreSQL and displayed directly in the dashboard modal for live browser verification.

### Search
* **Elasticsearch Integration:** Full-text indexing of all scheduled and sent emails into an `emails` index.
* **Fuzzy Multi-Field Search:** Multi-match queries with fuzzy matching across `subject` (boosted 3x), `recipientEmail` (boosted 2x), `senderEmail` (boosted 2x), `senderName`, and `body`.
* **Graceful Database Fallback:** If Elasticsearch is offline or unreachable, the search service automatically and transparently falls back to a PostgreSQL `findMany` query with case-insensitive `contains` filters, ensuring uninterrupted search functionality.

### Notifications
* **Slack OAuth Integration:** Users can connect their Slack workspace via Slack OAuth 2.0 (`/api/slack/connect`). Access tokens, webhook URLs, and channel bindings are securely persisted in the `SlackConnection` table.
* **Rate Limit Alerting:** Whenever a sender reaches their hourly limit, the background worker automatically dispatches a Slack Block Kit message to the configured channel detailing the sender, the reached quota, and the exact UTC timestamp when sending will resume.
* **Alert Deduplication:** Uses Redis-backed hourly alert keys (`slack_alert_sent:${userId}:${senderEmail}:${hourTs}`) to prevent spamming Slack channels if multiple emails are deferred in the same window.

### Monitoring
* **Bull Board Dashboard:** Embedded Bull Board interface mounted at `/admin/queues`, providing real-time visibility into the `email-dispatch-queue` (active, waiting, completed, failed, and delayed job counts, job payloads, and failure stack traces).

### Dashboard
* **Modern React Single-Page Application:** Built with React 18, Vite, TypeScript, and Tailwind CSS.
* **Core Tabs:** Dedicated views for **Scheduled** and **Sent** emails with real-time counters and automatic polling updates.
* **Instant Lead Verification:** Rich lead-parsing modal that reports valid recipients, duplicate emails removed, and invalid rows filtered out.
* **Interactive Message Viewer:** Modal inspect view displaying email subject, sender profile, recipient, dispatch status, error messages (if any), full HTML email body, and external links to Ethereal web previews.
* **Slack Integration Modal:** One-click modal to check Slack connection status, connect via Slack OAuth, or disconnect the integration.

---

## Tech Stack

| Layer | Technology | Version / Details |
|---|---|---|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS | React 18, Vite 6, Tailwind CSS 3, Lucide React |
| **Backend** | Node.js, Express.js, TypeScript | Express 4, TypeScript 5, tsx |
| **Database** | PostgreSQL | Relational storage with Prisma ORM 6 |
| **Queue** | BullMQ | BullMQ 5 (Redis-backed persistent queues) |
| **Cache & Queue Store** | Redis | Redis 7+ via `ioredis` |
| **Email Protocol** | SMTP via Nodemailer | Ethereal Email test inbox |
| **Search Engine** | Elasticsearch | Elasticsearch 8.x client (with PostgreSQL fallback) |
| **Authentication** | JWT & Google OAuth 2.0 | HTTP-only signed cookies, Google OAuth 2.0 |
| **Monitoring** | Bull Board | `@bull-board/express` & `@bull-board/api` |

---

## Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                   React Frontend (Vite)                  │
│   Dashboard • Compose Modal • Lead Parser • Bull Board   │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTP / Cookies (Port 5174 -> 4002)
                             ▼
┌──────────────────────────────────────────────────────────┐
│                    Express API Server                    │
│    Auth • Campaigns • Senders • Emails • Slack • Board   │
└──────────────┬─────────────┬─────────────┬───────────────┘
               │             │             │
        Prisma │      BullMQ │      Client │
               ▼             ▼             ▼
       ┌───────────┐   ┌───────────┐ ┌───────────────┐
       │PostgreSQL │   │   Redis   │ │ Elasticsearch │
       └───────────┘   └─────┬─────┘ └───────────────┘
                             │
                      Pop & Claim Jobs
                             │
                             ▼
               ┌───────────────────────────┐
               │    BullMQ Worker Runner   │
               │ Concurrency=5 • Locks=30s │
               └───────┬───────────┬───────┘
                       │           │
         Nodemailer    │           │ Slack Webhook / API
         (SMTP)        ▼           ▼
             ┌───────────────┐ ┌───────────┐
             │ Ethereal Mail │ │   Slack   │
             └───────────────┘ └───────────┘
```

---

## Scheduling Flow

1. **User Submits Schedule:** Through the frontend Compose modal, the user selects a verified Sender, specifies a subject and body, provides recipient addresses (manually or via file upload), and sets delay/limit options.
2. **Input Sanitization & Validation:** Express validates the request payload with Zod schemas. Recipient emails are normalized to lowercase, invalid formats are stripped, and duplicate addresses are deduplicated.
3. **Database Transaction:** 
   - A `Campaign` record is created in PostgreSQL with status `SCHEDULED`.
   - Individual `ScheduledEmail` records are generated in chunks of 500 with unique UUIDs, a deterministic `idempotencyKey`, and status `PENDING`.
4. **Queue Job Registration:** BullMQ jobs named `send-email` are added in bulk to `email-dispatch-queue`. The job ID is explicitly set to the email's deterministic `idempotencyKey` and delay is set to `max(0, scheduledAt - now)`.
5. **Search Indexing:** The email document is asynchronously indexed into Elasticsearch (or queued for fallback).
6. **Queue Processing:** When the delay elapses, an active worker claims the job:
   - Acquires an atomic Redis lock (`email_lock:${emailId}`).
   - Atomically updates status in PostgreSQL from `PENDING` to `PROCESSING`.
7. **Rate Limit Verification:**
   - Worker checks minimum inter-email delay (`MIN_EMAIL_DELAY_SECONDS`). If unfulfilled, the email reverts to `PENDING` and is rescheduled for the remaining duration.
   - Worker checks the hourly limit using an atomic Redis Lua increment. If the limit is reached, status is changed to `RATE_LIMITED`, a Slack notification is fired, and the job is rescheduled to the start of the next hour.
8. **SMTP Dispatch:** If all limits pass, Nodemailer dispatches the message via Ethereal SMTP.
9. **Final State & Preview URL:**
   - PostgreSQL status is updated to `SENT`, storing the Ethereal `messageId` and `previewUrl`.
   - Campaign `sentCount` is incremented. If all recipients are processed, the campaign status transitions to `COMPLETED`.
   - Elasticsearch document status is updated to `SENT`.
   - The distributed lock is released.

---

## Persistence and Restart Handling

Restart persistence is a core architectural requirement and is handled as follows:

* **PostgreSQL as Source of Truth:** Every campaign, scheduled email, sender profile, and user account resides in PostgreSQL. State transitions (`PENDING` → `PROCESSING` → `SENT` / `FAILED` / `RATE_LIMITED`) are written directly to disk.
* **Redis Sorted Set Persistence:** BullMQ stores delayed jobs in Redis sorted sets (`zset`) keyed by execution timestamp. Redis saves queue state to disk (via RDB/AOF).
* **Worker Restart Recovery:**
  - If the worker process restarts or crashes while jobs are delayed, **no jobs are lost**. Upon restarting, the worker reconnects to Redis and immediately resumes monitoring delayed sets.
  - If a worker terminates mid-execution, BullMQ locks expire after `lockDuration` (30 seconds), allowing stalled jobs to be re-claimed.
  - Database claim logic uses atomic updates (`updateMany` where status is `PENDING` or `RATE_LIMITED`). If another worker or a retried process attempts to process the same record, `claimCount === 0` aborts execution.
* **Backend API Restart:** The Express server is completely stateless. Restarting the backend server does not disrupt background workers or Redis queue timers.
* **Idempotency & Duplicate Prevention:**
  - Database records enforce uniqueness on `idempotencyKey`.
  - BullMQ jobs are created with `jobId = idempotencyKey`. If an API call or scheduling script is retried, BullMQ recognizes the identical `jobId` and rejects duplicate additions.

---

## Rate Limiting and Concurrency

### Concurrency
Worker concurrency is governed by `WORKER_CONCURRENCY` in `backend/.env` (default: `5`). Each worker thread processes jobs concurrently up to this limit without exceeding individual sender restrictions.

### Two-Tier Rate Limiting Implementation
1. **Minimum Delay Enforcement:**
   - Controlled by `MIN_EMAIL_DELAY_SECONDS` (system default: 2 seconds, can be overridden per campaign).
   - Redis key: `email_last_sent:${senderId}`.
   - When a job is picked up, the elapsed time since the sender's last dispatch is checked. If less than the required delay, the job is rescheduled by `delay - elapsed`.
2. **Hourly Quota Enforcement:**
   - Controlled by `MAX_EMAILS_PER_HOUR_PER_SENDER` (system default: 200 emails/hr, can be overridden per campaign).
   - Redis key: `email_rate:${senderId}:${hourWindowTimestamp}`.
   - Uses an atomic Lua script (`ATOMIC_HOURLY_INCR_LUA`) to evaluate and increment counters:
     ```lua
     local current = redis.call('GET', KEYS[1])
     if current and tonumber(current) >= tonumber(ARGV[1]) then
       return -1
     else
       local count = redis.call('INCR', KEYS[1])
       if count == 1 then
         redis.call('EXPIRE', KEYS[1], 7200)
       end
       return count
     end
     ```
   - If the script returns `-1`, the sender has exceeded their quota. The worker:
     - Sets the email status to `RATE_LIMITED`.
     - Updates `scheduledAt` to `nextWindowDate` (the start of the next hour).
     - Dispatches a Slack alert to the user.
     - Re-adds the job to BullMQ with a delay matching `nextWindowDate - now`.

### Design Trade-Offs
* **Delayed Re-Queueing vs. Queue Pausing:** Rather than pausing the entire queue (which would block unrelated senders), only the affected sender's jobs are delayed to their next valid window. Unaffected senders continue dispatching without interruption.

---

## Local Development Setup

### Prerequisites

Ensure the following native services are installed and running locally:
* **Node.js:** v20.x or v22.x
* **npm:** v10.x or higher
* **PostgreSQL:** v14+ running on port `5432`
* **Redis:** v7+ running on port `6379`
* **Elasticsearch (Optional):** v8.x running on port `9200` (application automatically falls back to PostgreSQL if unavailable)

---

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd email
```

---

### Step 2: Backend Setup

1. **Navigate to the backend directory and install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the `backend/` directory:
   ```env
   PORT=4002
   NODE_ENV=development

   DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@localhost:5432/<DB_NAME>?schema=public
   REDIS_URL=redis://localhost:6379
   ELASTICSEARCH_URL=http://localhost:9200

   FRONTEND_URL=http://localhost:5174
   BACKEND_URL=http://localhost:4002

   JWT_SECRET=your_jwt_secret_key
   COOKIE_SECRET=your_cookie_secret_key

   # Google OAuth 2.0
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:4002/api/auth/google/callback

   # Slack Integration
   SLACK_CLIENT_ID=your_slack_client_id
   SLACK_CLIENT_SECRET=your_slack_client_secret
   SLACK_REDIRECT_URI=http://localhost:4002/api/slack/callback

   # Ethereal SMTP (Leave blank to auto-generate test credentials)
   ETHEREAL_HOST=smtp.ethereal.email
   ETHEREAL_PORT=587
   ETHEREAL_USER=
   ETHEREAL_PASSWORD=

   # Worker & Limits
   WORKER_CONCURRENCY=5
   MIN_EMAIL_DELAY_SECONDS=2
   MAX_EMAILS_PER_HOUR_PER_SENDER=200
   ```

3. **Initialize the database:**
   ```bash
   npm run prisma:generate
   npm run prisma:push
   ```

4. **Start the API server:**
   ```bash
   npm run dev
   ```
   *The backend will listen on `http://localhost:4002`.*

5. **Start the BullMQ worker runner (in a separate terminal):**
   ```bash
   cd backend
   npx tsx src/worker-runner.ts # or after npm run build: npm run start:worker
   ```

6. **(Optional) Clean queue for fresh testing:**
   ```bash
   npm run queue:clear
   ```

---

### Step 3: Frontend Setup

1. **Navigate to the frontend directory and install dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

2. **Start the Vite development server:**
   ```bash
   npm run dev
   ```
   *The frontend will run on `http://localhost:5174` (or configured port) and proxy API requests to port `4002`.*

---

## Application URLs

* **Frontend Dashboard:** [http://localhost:5174](http://localhost:5174)
* **Backend Health Check:** [http://localhost:4002/health](http://localhost:4002/health)
* **Bull Board Queue Dashboard:** [http://localhost:4002/admin/queues](http://localhost:4002/admin/queues)

---

## API Endpoints Reference

### Authentication
* `POST /api/auth/register` — Create account with email, password, and name.
* `POST /api/auth/login` — Authenticate with email and password (sets JWT cookie).
* `POST /api/auth/logout` — Clear auth cookie.
* `GET  /api/auth/me` — Retrieve active user session.
* `GET  /api/auth/google` — Redirect to Google OAuth consent screen.
* `GET  /api/auth/google/callback` — Google OAuth callback handler.

### Senders
* `GET  /api/senders` — List sender identities associated with current user.
* `POST /api/senders` — Register a new sender profile (name, email, SMTP credentials).

### Campaigns & Scheduling
* `POST /api/campaigns` (or `/api/schedules`) — Create and schedule an email campaign.
* `GET  /api/campaigns` — List user campaigns with real-time delivery progress.
* `POST /api/campaigns/parse-leads` — Upload and validate recipient list from file or raw text.

### Emails
* `GET  /api/emails/scheduled` — Paginated list of emails with `PENDING` or `RATE_LIMITED` status.
* `GET  /api/emails/sent` — Paginated list of emails with `SENT` or `FAILED` status.
* `GET  /api/emails/counts` — Live count totals for scheduled and sent emails.
* `GET  /api/emails/search?q=...` — Search indexed emails (Elasticsearch with PostgreSQL fallback).
* `GET  /api/emails/:id` — Retrieve full email details including Ethereal preview URL and error logs.

### Slack Integration
* `GET  /api/slack/connect` — Retrieve Slack OAuth authorization URL.
* `GET  /api/slack/callback` — Exchange OAuth code and link workspace.
* `GET  /api/slack/status` — Check whether Slack alerting is active for user.
* `POST /api/slack/disconnect` — Unlink Slack connection.

---

## Not Implemented / Known Limitations

1. **OAuth Credentials Requirement:** Google OAuth and Slack integration require valid OAuth apps registered in the respective developer consoles. If credentials in `.env` are left empty, their respective endpoints will return descriptive configuration errors.
2. **Local Elasticsearch Dependency:** While Elasticsearch 8.x is fully integrated with index mappings and fuzzy querying, the system does not require Elasticsearch to function; it seamlessly falls back to PostgreSQL `ILIKE` queries when Elasticsearch is offline.
3. **Email Provider Scope:** By design for the assignment, email dispatch uses Ethereal test SMTP rather than production transactional email providers (SendGrid, SES, Mailgun). Real SMTP credentials can be configured per sender if desired.
4. **Queue Cleanup Command:** `npm run queue:clear` is intentionally a manual development-only tool and is never executed automatically on server startup to preserve job persistence across restarts.
