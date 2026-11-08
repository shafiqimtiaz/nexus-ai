import fs from "fs";
import path from "path";
import crypto from "crypto";
import { buildDemoSeed, DEMO_SEED_VERSION } from "./demo-seed";

const TMP_DB_PATH = "/tmp/nexus_db.json";

type Row = Record<string, unknown>;
type Payload = Row | Row[];
type DbSchema = { seed_version?: number; [table: string]: Row[] | number | undefined };

const toTime = (value: unknown) => new Date(value as string).getTime();

function loadDb(): DbSchema {
  if (fs.existsSync(TMP_DB_PATH)) {
    try {
      const stored = JSON.parse(fs.readFileSync(TMP_DB_PATH, "utf8"));
      if (stored.seed_version === DEMO_SEED_VERSION) return stored;
    } catch {}
  }

  const seed = buildDemoSeed();
  saveDb(seed);
  return seed;
}

function saveDb(db: DbSchema) {
  const serialized = JSON.stringify(db, null, 2);

  // write to /tmp so local edits (and any saved credentials) never touch the repo
  try {
    const dir = path.dirname(TMP_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TMP_DB_PATH, serialized, "utf8");
  } catch {}
}

export function readTable(table: string): Row[] {
  const db = loadDb();
  const rows = db[table];
  return Array.isArray(rows) ? rows : [];
}

export function writeTable(table: string, data: Row[]) {
  const db = loadDb();
  db[table] = data;
  saveDb(db);
}

export class MockSupabaseQueryBuilder {
  private table: string;
  private filters: ((item: Row) => boolean)[] = [];
  private limitVal?: number;
  private orderCol?: string;
  private orderAsc: boolean = true;
  private isInsert = false;
  private isUpsert = false;
  private isUpdate = false;
  private isDelete = false;
  private payload: Payload | null = null;
  private countOpts: { count?: string; head?: boolean } | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (options?.count) this.countOpts = options;
    return this;
  }

  insert(payload: Payload) {
    this.isInsert = true;
    this.payload = payload;
    return this;
  }

  upsert(payload: Payload) {
    this.isInsert = true;
    this.isUpsert = true;
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.isUpdate = true;
    this.payload = payload;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((item) => item[column] !== value);
    return this;
  }

  maybeSingle() {
    return this.execute(true);
  }

  single() {
    return this.execute(true);
  }

  gte(column: string, value: unknown) {
    this.filters.push((item) => {
      if (!item[column]) return false;
      return toTime(item[column]) >= toTime(value);
    });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push((item) => {
      if (!item[column]) return false;
      return toTime(item[column]) <= toTime(value);
    });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push((item) => {
      if (!item[column]) return false;
      return toTime(item[column]) < toTime(value);
    });
    return this;
  }

  in(column: string, values: unknown[]) {
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

  async then(
    resolve: (value: Awaited<ReturnType<MockSupabaseQueryBuilder["execute"]>>) => void,
    reject?: (reason: unknown) => void
  ) {
    try {
      const result = await this.execute();
      resolve(result);
    } catch (e) {
      if (reject) reject(e);
    }
  }

  private payloadRows(): Row[] {
    if (!this.payload) return [];
    return Array.isArray(this.payload) ? this.payload : [this.payload];
  }

  private async execute(single = false) {
    const data = readTable(this.table);
    let result = [...data];

    for (const filter of this.filters) {
      result = result.filter(filter);
    }

    if (this.orderCol) {
      result.sort((a, b) => {
        const valA = a[this.orderCol!];
        const valB = b[this.orderCol!];

        const timeA = Date.parse(valA as string);
        const timeB = Date.parse(valB as string);

        if (!isNaN(timeA) && !isNaN(timeB)) {
          return this.orderAsc ? timeA - timeB : timeB - timeA;
        }

        if (typeof valA === "string" && typeof valB === "string") {
          return this.orderAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return this.orderAsc
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      });
    }

    if (this.limitVal !== undefined) {
      result = result.slice(0, this.limitVal);
    }

    if (this.isUpsert) {
      const rows = this.payloadRows();
      const currentData = [...data];
      const insertedRows: Row[] = [];

      for (const row of rows) {
        let idx = -1;
        if (this.table === "platforms") {
          idx = currentData.findIndex((item) => item.type === row.type);
        } else if (this.table === "announcements") {
          idx = currentData.findIndex(
            (item) => item.platform_id === row.platform_id && item.external_id === row.external_id
          );
        } else if (this.table === "events") {
          // mirror live events_auto_dedup_idx to prevent duplicates
          const normTitle = (t: unknown) =>
            String(t ?? "")
              .replace(/[:–—].*$/, "")
              .toLowerCase()
              .replace(/\s+/g, " ")
              .trim();
          idx = currentData.findIndex(
            (item) =>
              (item.source_platform === row.source_platform &&
                item.source_external_id === row.source_external_id &&
                row.source_external_id) ||
              (row.is_auto_detected &&
                item.is_auto_detected &&
                normTitle(item.title) === normTitle(row.title) &&
                item.start_time === row.start_time &&
                item.event_type === row.event_type)
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
      const rows = this.payloadRows();
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

    if (this.countOpts) {
      return { data: this.countOpts.head ? null : result, count: result.length, error: null };
    }

    return { data: single ? (result[0] ?? null) : result, error: null };
  }
}
