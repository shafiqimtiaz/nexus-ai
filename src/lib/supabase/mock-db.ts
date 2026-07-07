import fs from "fs";
import path from "path";
import crypto from "crypto";

const TMP_DB_PATH = "/tmp/nexus_db.json";
const LOCAL_DB_PATH = path.join(process.cwd(), "src/data/db.json");

interface DbSchema {
  platforms: any[];
  events: any[];
  announcements: any[];
  labels: any[];
  resources: any[];
  resource_labels: any[];
  agent_actions: any[];
  app_settings: any[];
}

function getInitialData(): DbSchema {
  const now = new Date();

  // Helper to add interval
  const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 60 * 60 * 1000);
  const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 24 * 60 * 60 * 1000);

  return {
    platforms: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        type: "google_classroom",
        name: "CS 101 (Demo)",
        external_id: "demo-course-cs101",
        is_connected: true,
        last_synced_at: now.toISOString(),
      },
    ],
    events: [
      {
        id: "e1",
        title: "CS 101 Midterm Exam",
        description: "Covers chapters 1–6. Bring a calculator.",
        event_type: "exam",
        start_time: addDays(now, 3).toISOString(),
        end_time: addHours(addDays(now, 3), 2).toISOString(),
        source_platform: "11111111-1111-1111-1111-111111111111",
        source_external_id: "demo-exam-1",
        is_auto_detected: true,
      },
      {
        id: "e2",
        title: "Quiz 4: Recursion",
        description: "Short quiz on recursion and stack frames.",
        event_type: "quiz",
        start_time: addHours(addDays(now, 1), 4).toISOString(),
        end_time: addHours(addDays(now, 1), 5).toISOString(),
        source_platform: "11111111-1111-1111-1111-111111111111",
        source_external_id: "demo-quiz-4",
        is_auto_detected: true,
      },
      {
        id: "e3",
        title: "Assignment 3: Linked Lists",
        description: "Implement a doubly linked list with unit tests.",
        event_type: "assignment",
        start_time: addDays(now, 5).toISOString(),
        end_time: addDays(now, 5).toISOString(),
        source_platform: "11111111-1111-1111-1111-111111111111",
        source_external_id: "demo-assign-3",
        is_auto_detected: true,
      },
      {
        id: "e4",
        title: "Study block: Big-O review",
        description: "Self-scheduled review session before the midterm.",
        event_type: "study_block",
        start_time: addHours(addDays(now, 2), 18).toISOString(),
        end_time: addHours(addDays(now, 2), 20).toISOString(),
        source_platform: null,
        source_external_id: "demo-study-1",
        is_auto_detected: false,
      },
    ],
    announcements: [
      {
        id: "a1",
        platform_id: "11111111-1111-1111-1111-111111111111",
        external_id: "demo-ann-1",
        title: "Midterm logistics",
        content: "The midterm is in room 204. Seating chart will be posted the day before.",
        author: "Prof. Rivera",
        source_url: "https://classroom.google.com/demo/ann-1",
        announced_at: addHours(now, -2).toISOString(),
      },
      {
        id: "a2",
        platform_id: "11111111-1111-1111-1111-111111111111",
        external_id: "demo-ann-2",
        title: "Office hours moved",
        content: "This week office hours move to Thursday 2–4pm due to a faculty meeting.",
        author: "Prof. Rivera",
        source_url: "https://classroom.google.com/demo/ann-2",
        announced_at: addDays(now, -1).toISOString(),
      },
      {
        id: "a3",
        platform_id: "11111111-1111-1111-1111-111111111111",
        external_id: "demo-ann-3",
        title: "Assignment 3 posted",
        content: "Assignment 3 (Linked Lists) is now available. Starter code is attached.",
        author: "TA Nguyen",
        source_url: "https://classroom.google.com/demo/ann-3",
        announced_at: addDays(now, -2).toISOString(),
      },
      {
        id: "a4",
        platform_id: "11111111-1111-1111-1111-111111111111",
        external_id: "demo-ann-4",
        title: "Reading for next week",
        content: "Please read Chapter 7 (Trees) before Monday's lecture.",
        author: "Prof. Rivera",
        source_url: "https://classroom.google.com/demo/ann-4",
        announced_at: addDays(now, -3).toISOString(),
      },
    ],
    labels: [
      { id: "22222222-2222-2222-2222-222222222221", name: "Lecture Notes", color: "#059669" },
      { id: "22222222-2222-2222-2222-222222222222", name: "Reference", color: "#0d9488" },
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
        source_platform: "11111111-1111-1111-1111-111111111111",
      },
      {
        id: "r3",
        title: "Visualizing Data Structures",
        url: "https://visualgo.net/",
        description: "Interactive visualizations of common data structures.",
        is_pinned: false,
        source_platform: null,
      },
    ],
    resource_labels: [
      { resource_id: "r1", label_id: "22222222-2222-2222-2222-222222222222" },
      { resource_id: "r2", label_id: "22222222-2222-2222-2222-222222222221" },
      { resource_id: "r3", label_id: "22222222-2222-2222-2222-222222222222" },
    ],
    agent_actions: [
      {
        id: "act-1",
        title: "Concierge Sync Run",
        description: "Scanned Google Classroom and Discord for study events.",
        action_type: "sync",
        source_id: null,
        created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "act-2",
        title: "Autoscheduled Midterm",
        description: "Ingested CS 101 Midterm announcement and added study sessions on Google Calendar.",
        action_type: "calendar",
        source_id: "demo-ann-1",
        created_at: new Date(Date.now() - 3.8 * 60 * 60 * 1000).toISOString(),
      },
    ],
    app_settings: [],
  };
}

function loadDb(): DbSchema {
  if (fs.existsSync(TMP_DB_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(TMP_DB_PATH, "utf8"));
    } catch {}
  }
  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
    } catch {}
  }

  // Seed the database
  const seed = getInitialData();
  saveDb(seed);
  return seed;
}

function saveDb(db: DbSchema) {
  const serialized = JSON.stringify(db, null, 2);

  // Write only to /tmp to prevent writing sensitive credentials back into the Git-tracked db.json file
  try {
    const dir = path.dirname(TMP_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TMP_DB_PATH, serialized, "utf8");
  } catch {}
}

export function readTable(table: string): any[] {
  const db = loadDb();
  return (db as any)[table] || [];
}

export function writeTable(table: string, data: any[]) {
  const db = loadDb();
  (db as any)[table] = data;
  saveDb(db);
}

export class MockSupabaseQueryBuilder {
  private table: string;
  private filters: ((item: any) => boolean)[] = [];
  private limitVal?: number;
  private orderCol?: string;
  private orderAsc: boolean = true;
  private isInsert = false;
  private isUpsert = false;
  private isUpdate = false;
  private isDelete = false;
  private payload: any = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = "*") {
    return this;
  }

  insert(payload: any) {
    this.isInsert = true;
    this.payload = payload;
    return this;
  }

  upsert(payload: any, options?: any) {
    this.isInsert = true;
    this.isUpsert = true;
    this.payload = payload;
    return this;
  }

  update(payload: any) {
    this.isUpdate = true;
    this.payload = payload;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  maybeSingle() {
    return this.execute(true);
  }

  single() {
    return this.execute(true);
  }

  gte(column: string, value: any) {
    this.filters.push((item) => {
      if (!item[column]) return false;
      return new Date(item[column]).getTime() >= new Date(value).getTime();
    });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((item) => {
      if (!item[column]) return false;
      return new Date(item[column]).getTime() <= new Date(value).getTime();
    });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push((item) => {
      if (!item[column]) return false;
      return new Date(item[column]).getTime() < new Date(value).getTime();
    });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((item) => values.includes(item[column]));
    return this;
  }

  or(filterStr: string) {
    const parts = filterStr.split(",");
    this.filters.push((item) => {
      return parts.some((part) => {
        const [col, op, pattern] = part.split(".");
        if (op === "ilike") {
          const val = item[col];
          const search = pattern.replace(/%/g, "").toLowerCase();
          return typeof val === "string" && val.toLowerCase().includes(search);
        }
        return false;
      });
    });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitVal = count;
    return this;
  }

  // Support thenable behavior for await
  async then(resolve: any, reject: any) {
    try {
      const result = await this.execute();
      resolve(result);
    } catch (e) {
      if (reject) reject(e);
    }
  }

  private async execute(single = false) {
    const data = readTable(this.table);
    let result = [...data];

    // Apply filters
    for (const filter of this.filters) {
      result = result.filter(filter);
    }

    // Apply sorting
    if (this.orderCol) {
      result.sort((a, b) => {
        const valA = a[this.orderCol!];
        const valB = b[this.orderCol!];

        // Handle ISO string dates
        const timeA = Date.parse(valA);
        const timeB = Date.parse(valB);

        if (!isNaN(timeA) && !isNaN(timeB)) {
          return this.orderAsc ? timeA - timeB : timeB - timeA;
        }

        if (typeof valA === "string" && typeof valB === "string") {
          return this.orderAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return this.orderAsc ? valA - valB : valB - valA;
      });
    }

    // Apply limit
    if (this.limitVal !== undefined) {
      result = result.slice(0, this.limitVal);
    }

    if (this.isUpsert) {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const currentData = [...data];
      const insertedRows: any[] = [];

      for (const row of rows) {
        let idx = -1;
        if (this.table === "platforms") {
          idx = currentData.findIndex((item) => item.type === row.type);
        } else if (this.table === "announcements") {
          idx = currentData.findIndex(
            (item) => item.platform_id === row.platform_id && item.external_id === row.external_id
          );
        } else if (this.table === "events") {
          // Keep unique assignments/exams
          idx = currentData.findIndex(
            (item) =>
              item.source_platform === row.source_platform &&
              item.source_external_id === row.source_external_id &&
              row.source_external_id
          );
        }

        const newRow = {
          id: row.id || (idx !== -1 ? currentData[idx].id : crypto.randomUUID()),
          created_at: idx !== -1 ? currentData[idx].created_at : new Date().toISOString(),
          ...row,
        };

        if (idx !== -1) {
          currentData[idx] = newRow;
        } else {
          currentData.push(newRow);
        }
        insertedRows.push(newRow);
      }

      writeTable(this.table, currentData);
      return { data: Array.isArray(this.payload) ? insertedRows : insertedRows[0], error: null };
    }

    if (this.isInsert) {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const insertedRows = rows.map((row) => ({
        id: row.id || crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...row,
      }));
      writeTable(this.table, [...data, ...insertedRows]);
      return { data: Array.isArray(this.payload) ? insertedRows : insertedRows[0], error: null };
    }

    if (this.isUpdate) {
      const updatedList = data.map((item) => {
        const matches = this.filters.every((f) => f(item));
        if (matches) {
          return { ...item, ...this.payload, updated_at: new Date().toISOString() };
        }
        return item;
      });
      writeTable(this.table, updatedList);
      const updatedRows = updatedList.filter((item) => this.filters.every((f) => f(item)));
      return { data: single ? updatedRows[0] : updatedRows, error: null };
    }

    if (this.isDelete) {
      const remaining = data.filter((item) => !this.filters.every((f) => f(item)));
      writeTable(this.table, remaining);
      return { data: null, error: null };
    }

    // Custom nested resource join helper for resources
    if (this.table === "resources" && result.length > 0) {
      const rlData = readTable("resource_labels");
      const labels = readTable("labels");

      result = result.map((resource) => {
        const rLabels = rlData
          .filter((rl) => rl.resource_id === resource.id)
          .map((rl) => {
            const labelObj = labels.find((l) => l.id === rl.label_id);
            return labelObj ? { label: labelObj } : null;
          })
          .filter(Boolean);
        return {
          ...resource,
          labels: rLabels,
        };
      });
    }

    return { data: single ? (result[0] ?? null) : result, error: null };
  }
}
