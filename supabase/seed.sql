-- Nexus — Demo seed data
-- Run after 001_initial_schema.sql on a fresh DB. Populates the read-only demo
-- view so a logged-out visitor sees a realistic academic organizer.
-- Uses now() + intervals so dates stay future/fresh on every run.

-- Platform (a demo Google Classroom course, marked connected)
INSERT INTO platforms (id, type, name, external_id, is_connected, last_synced_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'google_classroom',
  'CS 101 (Demo)',
  'demo-course-cs101',
  true,
  now()
);

-- Events: exam ~3 days out, a quiz, an assignment due, a study block
INSERT INTO events (title, description, event_type, start_time, end_time, source_platform, source_external_id, is_auto_detected)
VALUES
  ('CS 101 Midterm Exam', 'Covers chapters 1–6. Bring a calculator.', 'exam',
    now() + interval '3 days', now() + interval '3 days' + interval '2 hours',
    '11111111-1111-1111-1111-111111111111', 'demo-exam-1', true),
  ('Quiz 4: Recursion', 'Short quiz on recursion and stack frames.', 'quiz',
    now() + interval '1 day' + interval '4 hours', now() + interval '1 day' + interval '5 hours',
    '11111111-1111-1111-1111-111111111111', 'demo-quiz-4', true),
  ('Assignment 3: Linked Lists', 'Implement a doubly linked list with unit tests.', 'assignment',
    now() + interval '5 days', now() + interval '5 days',
    '11111111-1111-1111-1111-111111111111', 'demo-assign-3', true),
  ('Study block: Big-O review', 'Self-scheduled review session before the midterm.', 'study_block',
    now() + interval '2 days' + interval '18 hours', now() + interval '2 days' + interval '20 hours',
    NULL, 'demo-study-1', false);

-- Announcements linked to the demo platform
INSERT INTO announcements (platform_id, external_id, title, content, author, source_url, announced_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'demo-ann-1', 'Midterm logistics',
    'The midterm is in room 204. Seating chart will be posted the day before.',
    'Prof. Rivera', 'https://classroom.google.com/demo/ann-1', now() - interval '2 hours'),
  ('11111111-1111-1111-1111-111111111111', 'demo-ann-2', 'Office hours moved',
    'This week office hours move to Thursday 2–4pm due to a faculty meeting.',
    'Prof. Rivera', 'https://classroom.google.com/demo/ann-2', now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'demo-ann-3', 'Assignment 3 posted',
    'Assignment 3 (Linked Lists) is now available. Starter code is attached.',
    'TA Nguyen', 'https://classroom.google.com/demo/ann-3', now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', 'demo-ann-4', 'Reading for next week',
    'Please read Chapter 7 (Trees) before Monday''s lecture.',
    'Prof. Rivera', 'https://classroom.google.com/demo/ann-4', now() - interval '3 days');

-- Labels
INSERT INTO labels (id, name, color)
VALUES
  ('22222222-2222-2222-2222-222222222221', 'Lecture Notes', '#059669'),
  ('22222222-2222-2222-2222-222222222222', 'Reference', '#0d9488');

-- Resources (2 pinned)
INSERT INTO resources (id, title, url, description, is_pinned, source_platform)
VALUES
  ('33333333-3333-3333-3333-333333333331', 'Big-O Cheat Sheet',
    'https://www.bigocheatsheet.com/', 'Time/space complexity reference for common algorithms.',
    true, NULL),
  ('33333333-3333-3333-3333-333333333332', 'Lecture 5: Recursion (slides)',
    'https://classroom.google.com/demo/lecture-5.pdf', 'Slides covering recursion and call stacks.',
    true, '11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333', 'Visualizing Data Structures',
    'https://visualgo.net/', 'Interactive visualizations of common data structures.',
    false, NULL);

-- Resource ↔ label links
INSERT INTO resource_labels (resource_id, label_id)
VALUES
  ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222221'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222');
