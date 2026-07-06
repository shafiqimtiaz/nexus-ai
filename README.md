# Nexus 🚀

Nexus is an **AI-powered personal academic organizer** that centralizes announcements, calendar events, resources, and an agentic AI chat into a single, unified workspace. 

Designed specifically for students, it integrates directly with Google Classroom (via Google OAuth) and Discord channels (via bot tokens), automatically parsing data to build calendar events, summarize announcements, organize resource links, and generate multi-day study blocks.

Nexus was developed for the **Kaggle 5-Day AI Agents Intensive Vibe Coding Capstone** (Concierge Track).

---

## 📖 Table of Contents
1. [Core Features](#-core-features)
2. [Rubric Concept Demonstration](#-rubric-concept-demonstration)
3. [Architecture & Data Flow](#-architecture--data-flow)
4. [Environment Variables](#-environment-variables)
5. [Database Schema & Migrations](#-database-schema--migrations)
6. [External Platform Integration Setup](#-external-platform-integration-setup)
7. [Getting Started (Local Development)](#-getting-started-local-development)
8. [Deployment Guide (Vercel)](#-deployment-guide-vercel)
9. [Public Demo Mode](#-public-demo-mode)

---

## ✨ Core Features

*   **Aggregated Dashboard:** Displays upcoming assessments (with active countdowns), today's study blocks, stats (e.g. unread count, days to next exam), and pinned resource links.
*   **Agentic AI Chat:** A multi-step tool-calling assistant backed by **Gemini 2.5 Flash**. The agent can read course data, create/modify study blocks, search resource links, parse announcements for quiz dates, and automatically save resources.
*   **Classroom & Discord Integration:** Automatically fetches Classroom course materials/assignments and Discord channel announcements.
*   **Stale-While-Revalidate Syncing:** Ingests platform messages on-load without hitting rate limits, using a smart 15-minute cached ingestion loop.
*   **Lightweight Academic Calendar:** Custommonth-view and listing component built for tracking exam events, quizzes, and agent-generated study blocks.
*   **Resource Library:** Save, search, filter, and label academic resource links (Google Drives, PDF links, lectures).
*   **Demo Mode (Concierge Gated):** Provides an unauthenticated read-only mock dashboard and calendar with pre-seeded sample data for judges, preventing access to the owner's OAuth tokens.

---

## 🎯 Rubric Concept Demonstration

Nexus demonstrates key agentic capabilities across the Kaggle hackathon requirements:

| Rubric Concept | Demonstrated in | Technical Implementation |
|:---|:---|:---|
| **MCP Server** | Code | An in-repo Google Classroom MCP server using the `@modelcontextprotocol/sdk`. The Next.js API route communicates with this local server over an in-memory transport bridge, mapping Classroom announcements, coursework, and materials directly to tool schemas. |
| **Antigravity Workflow** | Video / Process | Development tasks were organized and tracked using `/docs/plans/spec.md`, `plan.md`, and `task.md`. Code iterations and dependency upgrades were managed inside the custom sandboxed workspace. |
| **Security Features** | Code / Video | Hardened auth system using **Supabase Auth** with RLS policies denying all public/authenticated client-side requests. All database interactions run server-side via the service-role client. Stored OAuth and Discord tokens never leave the server. Search queries are sanitized against PostgREST injection. |
| **Deployability** | Video / Config | Fully configured for **Vercel** with comprehensive instructions to deploy the database migrations, set environment variables, and configure production OAuth callbacks. |
| **Agent Skills** | Code | Custom toolsets in `src/lib/ai/tools.ts` for managing calendar CRUD, resources indexing, and multi-day study plan generation. |

---

## 🏗️ Architecture & Data Flow

Nexus routes all external requests and database modifications through a server-side boundary, keeping API tokens secure and the frontend lightning-fast.

```
                  ┌──────────────────┐          ┌─────────────┐
                  │ Google Classroom │          │   Discord   │
                  └────────┬─────────┘          └──────┬──────┘
                           │ OAuth token                │ bot token
  ┌────────────────────────▼─────────┐                  │
  │  Classroom MCP Server (in-repo)  │                  │
  └────────────────────────┬─────────┘                  │
                           │                            │
                     ┌─────▼────────────────────────────▼────┐
                     │          Next.js Backend API          │
                     │  - Ingests /api/sync                  ├─► Supabase Database (RLS)
                     │  - Chat endpoint /api/chat            │   (Stores cached data)
                     │  - Tool-calling agent: Gemini         │
                     └───────────────────┬───────────────────┘
                                         │ JSON Responses
                                         │ (No sensitive tokens leaked)
                     ┌───────────────────▼───────────────────┐
                     │          Next.js Frontend UI          │
                     │  - Logged-in Owner (Full access)      │
                     │  - Demo User (Read-only Seeded data)  │
                     └───────────────────────────────────────┘
```

---

## 🔑 Environment Variables

To run Nexus, populate the following environment variables in `.env` (local development) or your hosting provider dashboard (Vercel):

```bash
# Supabase Configuration
SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# Gemini API Key
GOOGLE_GENERATIVE_AI_API_KEY=YOUR_GEMINI_API_KEY

# Google Cloud OAuth (For Google Classroom Access)
GOOGLE_OAUTH_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Next.js Public URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🗄️ Database Schema & Migrations

Nexus uses Supabase (PostgreSQL) for all storage.
Apply the migration script located at `supabase/migrations/001_initial_schema.sql` to initialize your database.

This will create:
*   `platforms`: Storing token credentials, channel targets, and sync metadata.
*   `announcements`: Caching ingested alerts from Google Classroom and Discord (uniquely index-deduped).
*   `events`: Academic dates, assignments, exams, and study blocks.
*   `resources` & `labels`: A taggable bookmarks repository for academic links.

*Note: Row Level Security (RLS) is enabled on all tables. Since the web client accesses everything via Next.js server actions / API endpoints using the service role client, standard browser access to Supabase is disabled by design for security.*

To seed the initial mock data for Demo Mode, run the SQL script in `supabase/seed.sql` inside the Supabase SQL editor.

---

## 🔌 External Platform Integration Setup

### 1. Google Cloud Console (Google Classroom API)
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project and enable the **Google Classroom API**.
3. Configure the **OAuth Consent Screen** (User type: External, Publishing status: Testing).
4. Add your personal Google account as a **Test User** (since the app is unverified).
5. Create **OAuth Client Credentials** (Web Application).
6. Set the authorized redirect URIs to:
   *   Local: `http://localhost:3000/api/auth/google/callback`
   *   Prod: `https://your-app-domain.vercel.app/api/auth/google/callback`
7. Copy the client ID and secret into your env configuration.

### 2. Discord Bot Setup
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create a new Application, navigate to the **Bot** tab, and copy your Bot Token.
3. Scroll down to **Privileged Gateway Intents** and enable **Message Content Intent** (required to read announcements).
4. Go to **OAuth2 -> URL Generator**:
   *   Scopes: `bot`
   *   Bot Permissions: `Read Messages/View Channels`, `Read Message History`
5. Generate the invite URL, paste it into your browser, and add the bot to your target Discord server.
6. Copy the Channel ID of the announcements channel where you want the bot to sync messages.

---

## 💻 Getting Started (Local Development)

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/shafiqimtiaz/Nexus-AI.git
    cd Nexus-AI
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Setup Environment File:**
    Copy `.env.example` to `.env` and fill in the keys matching your Google Console, Discord, and Supabase credentials.

4.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    Open `http://localhost:3000` to preview.

---

## 🚀 Deployment Guide (Vercel)

Nexus is designed to deploy seamlessly to Vercel:

1.  Push your code to a public or private GitHub repository.
2.  Import the repository on Vercel.
3.  Configure all variables in the **Environment Variables** panel. Make sure `NEXT_PUBLIC_APP_URL` and `GOOGLE_OAUTH_REDIRECT_URI` use your production Vercel domain.
4.  Click **Deploy**.
5.  After deployment, update your Google Cloud Console OAuth redirect URIs to include the production Vercel callback URL.

---

## 🔒 Public Demo Mode

To allow Kaggle judges to review the application without requiring OAuth connections or leaking personal student data:
*   When visiting the URL without logging in, the app operates in a secure **Read-Only Demo Mode**.
*   This mode displays pre-seeded mock announcements, assessments, and study calendar cells.
*   Mutations (creating/deleting resources or events) and the live AI chat widget are disabled in this mode, preventing API key/token usage by unauthenticated visitors.
*   To test full capabilities locally or in production, navigate to `/login` and sign in with the owner credentials configured in your Supabase Auth panel.
