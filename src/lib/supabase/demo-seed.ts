// Demo data for the mock DB. All timestamps are relative to "now" so the
// demo dashboard and calendar always have content, whenever they're opened.

export const DEMO_SEED_VERSION = 2;

const CLASSROOM_ID = "11111111-1111-1111-1111-111111111111";
const DISCORD_ID = "11111111-1111-1111-1111-111111111112";
const LABEL_NOTES = "22222222-2222-2222-2222-222222222221";
const LABEL_REFERENCE = "22222222-2222-2222-2222-222222222222";
const LABEL_PRACTICE = "22222222-2222-2222-2222-222222222223";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function buildDemoSeed() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const iso = (d: Date) => d.toISOString();
  const fromNow = (ms: number) => new Date(now.getTime() + ms);
  // Day offset from midnight today, at a fixed local hour.
  const at = (dayOffset: number, hour: number, minute = 0) =>
    new Date(today.getTime() + dayOffset * DAY + hour * HOUR + minute * 60 * 1000);

  const event = (
    id: string,
    title: string,
    description: string,
    event_type: string,
    start: Date,
    end: Date | null,
    source_platform: string | null,
    is_auto_detected = true
  ) => ({
    id,
    title,
    description,
    event_type,
    status: "scheduled",
    start_time: iso(start),
    end_time: end ? iso(end) : null,
    source_platform,
    source_external_id: `demo-${id}`,
    is_auto_detected,
  });

  return {
    seed_version: DEMO_SEED_VERSION,
    platforms: [
      {
        id: CLASSROOM_ID,
        type: "google_classroom",
        name: "CS 101 (Demo)",
        external_id: "demo-course-cs101",
        is_connected: true,
        last_synced_at: iso(fromNow(-20 * 60 * 1000)),
      },
      {
        id: DISCORD_ID,
        type: "discord",
        name: "#math-201-announcements",
        external_id: "demo-channel-math201",
        is_connected: true,
        last_synced_at: iso(fromNow(-20 * 60 * 1000)),
      },
    ],
    events: [
      event(
        "e1",
        "CS 101 Lecture: Trees",
        "Room 110. Bring questions on Chapter 7.",
        "other",
        at(0, 10),
        at(0, 11, 30),
        CLASSROOM_ID
      ),
      event(
        "e2",
        "Study block: Recursion practice",
        "Work through 5 recursion problems from the practice set.",
        "study_block",
        at(0, 15),
        at(0, 17),
        null,
        false
      ),
      event(
        "e3",
        "Quiz 4: Recursion",
        "Short quiz on recursion and stack frames.",
        "quiz",
        at(1, 9),
        at(1, 10),
        CLASSROOM_ID
      ),
      event(
        "e4",
        "Study block: Big-O review",
        "Self-scheduled review session before the midterm.",
        "study_block",
        at(2, 18),
        at(2, 20),
        null,
        false
      ),
      event(
        "e5",
        "CS 101 Midterm Exam",
        "Covers chapters 1–6. Room 204. Bring a calculator.",
        "exam",
        at(3, 14),
        at(3, 16),
        CLASSROOM_ID
      ),
      event(
        "e6",
        "MATH 201 Problem Set 5",
        "Integration by parts, problems 1–12. Submit on Gradescope.",
        "assignment",
        at(4, 23, 59),
        null,
        DISCORD_ID
      ),
      event(
        "e7",
        "Assignment 3: Linked Lists",
        "Implement a doubly linked list with unit tests.",
        "assignment",
        at(5, 23, 59),
        null,
        CLASSROOM_ID
      ),
      event(
        "e8",
        "MATH 201 Quiz 3",
        "Covers sections 7.1–7.3.",
        "quiz",
        at(6, 11),
        at(6, 11, 45),
        DISCORD_ID
      ),
      event(
        "e9",
        "Office hours: Prof. Rivera",
        "Thursday office hours (moved this week).",
        "other",
        at(4, 14),
        at(4, 16),
        CLASSROOM_ID
      ),
      event(
        "e10",
        "MATH 201 Midterm",
        "Chapters 5–8. Formula sheet allowed.",
        "exam",
        at(12, 13),
        at(12, 15),
        DISCORD_ID
      ),
      event(
        "e11",
        "Assignment 2: Arrays",
        "Dynamic array implementation.",
        "assignment",
        at(-6, 23, 59),
        null,
        CLASSROOM_ID
      ),
      event(
        "e12",
        "Quiz 3: Sorting",
        "Merge sort and quicksort.",
        "quiz",
        at(-4, 9),
        at(-4, 10),
        CLASSROOM_ID
      ),
      event(
        "e13",
        "Final project proposal",
        "One-page proposal for the CS 101 final project.",
        "assignment",
        at(18, 23, 59),
        null,
        CLASSROOM_ID
      ),
    ],
    announcements: [
      {
        id: "a1",
        platform_id: CLASSROOM_ID,
        external_id: "demo-ann-1",
        title: "Midterm logistics",
        content: "The midterm is in room 204. Seating chart will be posted the day before.",
        author: "Prof. Rivera",
        source_url: "https://classroom.google.com/demo/ann-1",
        announced_at: iso(fromNow(-2 * HOUR)),
        is_read: false,
        ai_summary:
          "📍 Midterm location: Room 204. A seating chart goes up the day before the exam.",
      },
      {
        id: "a2",
        platform_id: DISCORD_ID,
        external_id: "demo-ann-2",
        title: "Problem Set 5 released",
        content:
          "PS5 is out — integration by parts, problems 1–12. Due Thursday at midnight on Gradescope.",
        author: "Dr. Okafor",
        source_url: "https://discord.com/channels/demo/ann-2",
        announced_at: iso(fromNow(-6 * HOUR)),
        is_read: false,
        ai_summary:
          "📝 Problem Set 5 (integration by parts, Q1–12) is due Thursday at midnight on Gradescope.",
      },
      {
        id: "a3",
        platform_id: CLASSROOM_ID,
        external_id: "demo-ann-3",
        title: "Office hours moved",
        content: "This week office hours move to Thursday 2–4pm due to a faculty meeting.",
        author: "Prof. Rivera",
        source_url: "https://classroom.google.com/demo/ann-3",
        announced_at: iso(fromNow(-1 * DAY)),
        is_read: false,
        ai_summary:
          "🕑 Office hours are moved to Thursday 2–4 PM this week (faculty meeting conflict).",
      },
      {
        id: "a4",
        platform_id: CLASSROOM_ID,
        external_id: "demo-ann-4",
        title: "Assignment 3 posted",
        content: "Assignment 3 (Linked Lists) is now available. Starter code is attached.",
        author: "TA Nguyen",
        source_url: "https://classroom.google.com/demo/ann-4",
        announced_at: iso(fromNow(-2 * DAY)),
        is_read: true,
        ai_summary:
          "📝 Assignment 3 (Linked Lists) is live — starter code is attached. Due date in the calendar.",
      },
      {
        id: "a5",
        platform_id: DISCORD_ID,
        external_id: "demo-ann-5",
        title: "Quiz 3 coverage",
        content: "Next week's quiz covers sections 7.1 through 7.3. No calculators.",
        author: "Dr. Okafor",
        source_url: "https://discord.com/channels/demo/ann-5",
        announced_at: iso(fromNow(-3 * DAY)),
        is_read: true,
        ai_summary: "🧮 MATH 201 Quiz 3 covers sections 7.1–7.3. No calculators allowed.",
      },
      {
        id: "a6",
        platform_id: CLASSROOM_ID,
        external_id: "demo-ann-6",
        title: "Reading for next week",
        content: "Please read Chapter 7 (Trees) before Monday's lecture.",
        author: "Prof. Rivera",
        source_url: "https://classroom.google.com/demo/ann-6",
        announced_at: iso(fromNow(-4 * DAY)),
        is_read: true,
        ai_summary: "📖 Before Monday's lecture: read Chapter 7 (Trees).",
      },
    ],
    labels: [
      { id: LABEL_NOTES, name: "Lecture Notes", color: "#059669" },
      { id: LABEL_REFERENCE, name: "Reference", color: "#0d9488" },
      { id: LABEL_PRACTICE, name: "Practice", color: "#d97706" },
    ],
    resources: [
      {
        id: "r1",
        title: "Big-O Cheat Sheet",
        url: "https://www.bigocheatsheet.com/",
        description: "Time/space complexity reference for common algorithms.",
        is_pinned: true,
        source_platform: null,
      },
      {
        id: "r2",
        title: "Lecture 5: Recursion (slides)",
        url: "https://classroom.google.com/demo/lecture-5.pdf",
        description: "Slides covering recursion and call stacks.",
        is_pinned: true,
        source_platform: CLASSROOM_ID,
      },
      {
        id: "r3",
        title: "Visualizing Data Structures",
        url: "https://visualgo.net/",
        description: "Interactive visualizations of common data structures.",
        is_pinned: false,
        source_platform: null,
      },
      {
        id: "r4",
        title: "Paul's Online Math Notes: Integration by Parts",
        url: "https://tutorial.math.lamar.edu/Classes/CalcII/IntegrationByParts.aspx",
        description: "Worked examples for Problem Set 5.",
        is_pinned: true,
        source_platform: DISCORD_ID,
      },
      {
        id: "r5",
        title: "Recursion practice set",
        url: "https://classroom.google.com/demo/recursion-practice.pdf",
        description: "15 practice problems with solutions.",
        is_pinned: false,
        source_platform: CLASSROOM_ID,
      },
    ],
    resource_labels: [
      { resource_id: "r1", label_id: LABEL_REFERENCE },
      { resource_id: "r2", label_id: LABEL_NOTES },
      { resource_id: "r3", label_id: LABEL_REFERENCE },
      { resource_id: "r4", label_id: LABEL_REFERENCE },
      { resource_id: "r5", label_id: LABEL_PRACTICE },
    ],
    agent_actions: [
      {
        id: "act-1",
        title: "Added Problem Set 5 deadline",
        description:
          "Found a due date in a MATH 201 Discord announcement and added it to your calendar.",
        action_type: "calendar",
        source_id: "a2",
        created_at: iso(fromNow(-5.9 * HOUR)),
      },
      {
        id: "act-2",
        title: "Saved integration notes",
        description: "Linked Paul's Online Math Notes from the PS5 announcement to Resources.",
        action_type: "resource",
        source_id: null,
        created_at: iso(fromNow(-5.8 * HOUR)),
      },
      {
        id: "act-3",
        title: "Scheduled a Big-O review block",
        description: "Added a 2-hour study block two days before the CS 101 midterm.",
        action_type: "chat",
        source_id: null,
        created_at: iso(fromNow(-3 * HOUR)),
      },
      {
        id: "act-4",
        title: "Synced Classroom and Discord",
        description: "Pulled 2 new announcements and updated the midterm location.",
        action_type: "sync",
        source_id: null,
        created_at: iso(fromNow(-20 * 60 * 1000)),
      },
    ],
    app_settings: [],
  };
}
