# Student-Jarvis — Project Specification

> A personal AI-powered academic organizer that keeps a student on track by centralizing announcements, calendars, resources, and an intelligent agent — all in one web interface.

**Project Context:** Google AI Agents Hackathon (Kaggle)
**Type:** Hosted web application (single-user, personal tool)

---

## 1. Product Overview

Student-Jarvis is a web-based academic assistant that connects to a student's communication platforms (Discord, Slack, Google Classroom), pulls in important academic announcements, and presents everything through an organized dashboard. An AI agent chat provides intelligent assistance — summarizing content, managing the calendar, searching resources, and generating study plans.

### Core Value Proposition
- **One place** for all academic announcements across platforms
- **Never miss** an exam, quiz, or deadline
- **AI-powered** study assistance and organization
- **Zero context switching** between Discord, Slack, Classroom, and Google Calendar

---

## 2. Pages & Features

### 2.1 Dashboard

The landing page. A quick-glance summary of the student's academic life.

| Widget | Priority | Description |
|--------|----------|-------------|
| Upcoming Exams/Quizzes | **Primary** | Next 7 days of exams and quizzes with countdown timers |
| Today's Schedule | **Primary** | Today's tasks and study blocks |
| Quick Stats | **Primary** | Days until next exam, unread announcements count, tasks completed |
| Pinned Resources | **Primary** | User-pinned important resource links |
| Recent Announcements | Secondary | Latest announcements from connected platforms |
| AI Study Tip | Secondary | AI-generated daily study tip or motivational nudge |

### 2.2 Calendar

A custom calendar view with academic events.

| Feature | Description |
|---------|-------------|
| Monthly/Weekly/Daily views | Toggle between calendar views |
| Exam & Quiz markers | Visual markers for upcoming assessments |
| Event creation | Manually add exams, quizzes, assignments, study blocks |
| Auto-detected events | AI parses announcements and suggests calendar events |
| Google Calendar sync | **One-way push only** — events created in the app are pushed to Google Calendar. Changes in Google Calendar are NOT pulled back. |
| Color coding | Different colors for exams, quizzes, assignments, study blocks |

### 2.3 Resources

A curated collection of academic resource **links** (not file uploads).

| Feature | Description |
|---------|-------------|
| Link storage | Save URLs to Google Drive files, PDFs, websites, and other resources |
| No file uploads | Only links are stored — no actual files are uploaded or hosted |
| Label system | Resources are organized and filtered by user-defined labels (e.g., "Math 101", "Final Exam Prep", "Lecture Notes") |
| Auto-pulled links | AI agent can pull resource links shared in connected platforms |
| Search | Search across all saved resource links by title or label |
| Pin to Dashboard | Mark important resources as pinned to surface them on the Dashboard |

### 2.4 AI Agent Chat

A conversational AI assistant with tool-calling (agentic) capabilities.

| Capability | Description |
|------------|-------------|
| Multi-model support | User can configure any LLM API (Gemini, OpenAI, etc.) via their own API key |
| Summarize announcements | Summarize recent announcements from any/all connected platforms |
| Create/edit calendar events | Add or modify calendar entries through conversation |
| Search resources | Find resources across connected platforms and saved links |
| Set reminders | Create study reminders and notifications |
| Answer course questions | Answer questions based on linked resources and course context |
| Generate study plans | Create personalized study plans based on upcoming exams/quizzes |
| Tool calling | The agent calls backend tools to perform actions (not just text responses) |

### 2.5 Options (Settings)

Configuration page for platform connections and preferences.

| Feature | Description |
|---------|-------------|
| Platform connections | Connect/disconnect Discord, Slack, Google Classroom |
| Connection method | User provides the channel/server URL and authenticates via Google OAuth |
| Connection status | Visual indicator showing which platforms are connected and their sync status |
| AI model config | Set the LLM provider and API key |
| Google Calendar link | Connect/disconnect Google Calendar for one-way push |
| Notification preferences | Configure how and when the student receives alerts |

---

## 3. Supported Platforms

| Platform | Connection Method | What It Pulls |
|----------|-------------------|---------------|
| **Discord** | Server/channel URL + Google OAuth | Announcements, shared resources, pinned messages |
| **Slack** | Workspace/channel URL + Google OAuth | Announcements, shared resources, pinned messages |
| **Google Classroom** | Class URL + Google OAuth | Assignments, announcements, materials, due dates |

All platform connections are managed via **MCP (Model Context Protocol) servers** on the backend.

---

## 4. Authentication & Authorization

| Aspect | Detail |
|--------|--------|
| User identity | Single-user app — no login/registration system |
| Platform auth | Google OAuth used to authenticate with all connected platforms |
| API keys | User provides their own LLM API key in Settings |
| Data scope | App only accesses channels/classes the user explicitly connects |

---

## 5. What the App CAN Do

- ✅ Centralize announcements from Discord, Slack, and Google Classroom
- ✅ Display a dashboard with upcoming exams, today's schedule, stats, and pinned resources
- ✅ Maintain a custom calendar with exam/quiz/assignment markers
- ✅ Push calendar events to Google Calendar (one-way)
- ✅ Store and organize resource **links** by labels
- ✅ Provide an AI agent that can summarize, search, plan, and manage events
- ✅ Auto-detect exam dates and resource links from announcements
- ✅ Support any LLM provider via user-provided API keys
- ✅ Connect to platforms via MCP servers

---

## 6. What the App CANNOT Do

- ❌ Multi-user support — this is a single-student personal tool
- ❌ Host or upload files — only links are stored in Resources
- ❌ Two-way Google Calendar sync — changes in Google Calendar are NOT reflected in the app
- ❌ Access platforms without explicit user connection and authentication
- ❌ Work offline — requires internet for platform syncing and AI features
- ❌ Replace the communication platforms — it aggregates, not replaces
- ❌ Support platforms beyond Discord, Slack, and Google Classroom (for now)

---

## 7. Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   Discord   │     │    Slack     │     │ Google Classroom │
└──────┬──────┘     └──────┬──────┘     └────────┬─────────┘
       │                   │                     │
       └───────────┬───────┴─────────────────────┘
                   │
            ┌──────▼──────┐
            │ MCP Servers │  (one per platform)
            └──────┬──────┘
                   │
            ┌──────▼──────┐
            │   Backend   │──────► Google Calendar API
            │   Server    │       (one-way push)
            └──────┬──────┘
                   │
            ┌──────▼──────┐
            │   Web App   │
            │  (Frontend) │
            └─────────────┘
                   │
            ┌──────▼──────┐
            │  AI Agent   │──► LLM API (user's key)
            │   (Chat)    │
            └─────────────┘
```

---

## 8. Non-Functional Requirements

| Requirement | Detail |
|-------------|--------|
| **Hosting** | Deployed/hosted web application (not local-only) |
| **Responsiveness** | Web-first design, should work on desktop and tablet |
| **Performance** | Dashboard loads within 2 seconds; AI responses stream in real-time |
| **Security** | API keys stored securely; OAuth tokens never exposed to frontend |
| **Hackathon scope** | MVP-focused — polish core features over breadth |

---

## 9. Terminology

| Term | Meaning |
|------|---------|
| **MCP Server** | Model Context Protocol server — handles tool execution and platform communication for the AI agent |
| **Resource** | A saved link (URL) to an academic material — not an uploaded file |
| **Label** | A user-defined tag for organizing resources |
| **Platform** | A communication service (Discord, Slack, Google Classroom) |
| **Quick Stats** | Numerical summaries on the dashboard (e.g., "3 days until next exam") |
