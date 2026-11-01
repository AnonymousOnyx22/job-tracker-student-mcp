import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const STATUSES = ["applied", "interview", "offer", "rejected"] as const;
export type Status = (typeof STATUSES)[number];

export const TYPES = ["job", "internship"] as const;
export type AppType = (typeof TYPES)[number];

export interface Application {
  id: number;
  company: string;
  role: string;
  type: AppType;
  status: Status;
  /** Last day to apply, as YYYY-MM-DD. */
  deadline: string | null;
  /** The interview date as YYYY-MM-DD, or YYYY-MM-DDTHH:MM with a time. */
  interview_date: string | null;
  source: string | null;
  notes: string | null;
  added: string;
  updated: string;
}

export interface UpcomingItem {
  id: number;
  company: string;
  role: string;
  kind: "deadline" | "interview";
  when: string;
  days_left: number;
  reminder: string;
}

/** Where the applications are saved, JOB_TRACKER_FILE if it is set. */
export function defaultPath(): string {
  return process.env.JOB_TRACKER_FILE || join(homedir(), ".job-tracker-student-mcp", "applications.json");
}

/** The saved applications, kept in one JSON file on this computer. */
export class Store {
  constructor(public readonly path: string = defaultPath()) {}

  list(): Application[] {
    if (!existsSync(this.path)) return [];
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(this.path, "utf8"));
    } catch {
      throw new Error(`Could not read ${this.path}. The file is not valid JSON. Fix it or move it away, then try again.`);
    }
    if (!Array.isArray(data)) throw new Error(`Could not read ${this.path}. It should hold a list of applications.`);
    return data as Application[];
  }

  save(apps: Application[]): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, JSON.stringify(apps, null, 2) + "\n", "utf8");
    renameSync(temp, this.path);
  }
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

/** True when the text is a real calendar date written as YYYY-MM-DD. */
export function isDate(text: string): boolean {
  const m = DATE.exec(text);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Checks a deadline, which must be YYYY-MM-DD. */
export function checkDeadline(text: string): string {
  if (!isDate(text)) throw new Error(`The deadline "${text}" is not a real date. Use YYYY-MM-DD, for example 2026-11-15.`);
  return text;
}

/** Checks an interview date, which is YYYY-MM-DD or YYYY-MM-DDTHH:MM. */
export function checkWhen(text: string): string {
  const m = DATE_TIME.exec(text);
  if (isDate(text) || (m && isDate(m[1]))) return text;
  throw new Error(`The interview date "${text}" is not valid. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM, for example 2026-11-20T14:30.`);
}

/** Today as YYYY-MM-DD on this computer, or the date you pass in. */
export function todayOr(text?: string): string {
  if (text !== undefined) {
    if (!isDate(text)) throw new Error(`The date "${text}" is not a real date. Use YYYY-MM-DD, for example 2026-11-15.`);
    return text;
  }
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Whole days from one YYYY-MM-DD date to another. Negative when the second is earlier. */
export function daysBetween(from: string, to: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

function reminderFor(daysLeft: number): string {
  if (daysLeft < 0) return `overdue by ${-daysLeft} ${-daysLeft === 1 ? "day" : "days"}`;
  if (daysLeft === 0) return "due today";
  if (daysLeft === 1) return "due tomorrow";
  if (daysLeft <= 3) return `due soon, in ${daysLeft} days`;
  return `in ${daysLeft} days`;
}

/**
 * Deadlines of open applications and interview dates, sorted by date.
 * Applications that are rejected or already an offer have nothing left to remind you about.
 */
export function upcoming(apps: Application[], today: string, withinDays: number, includeOverdue: boolean): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const app of apps) {
    let kind: UpcomingItem["kind"] | null = null;
    let when: string | null = null;
    if (app.status === "applied" && app.deadline) [kind, when] = ["deadline", app.deadline];
    if (app.status === "interview" && app.interview_date) [kind, when] = ["interview", app.interview_date];
    if (!kind || !when) continue;
    const daysLeft = daysBetween(today, when);
    if (daysLeft > withinDays || (daysLeft < 0 && !includeOverdue)) continue;
    items.push({ id: app.id, company: app.company, role: app.role, kind, when, days_left: daysLeft, reminder: reminderFor(daysLeft) });
  }
  return items.sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : a.id - b.id));
}

const CSV_COLUMNS = ["id", "company", "role", "type", "status", "deadline", "interview_date", "source", "notes", "added", "updated"] as const;

function csvCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  // A cell that starts with one of these is run as a formula by spreadsheet apps.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(apps: Application[]): string {
  const rows = apps.map((app) => CSV_COLUMNS.map((col) => csvCell(app[col])).join(","));
  return [CSV_COLUMNS.join(","), ...rows].join("\n") + "\n";
}

/** Splits CSV text into rows of cells. Handles quoted cells, doubled quotes, CRLF and a leading byte order mark. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let started = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      started = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
      started = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      if (started || cell) rows.push([...row, cell]);
      row = [];
      cell = "";
      started = false;
    } else {
      cell += ch;
      started = true;
    }
  }
  if (quoted) throw new Error("The CSV has a quote that is never closed. Check the cell that starts with a quote.");
  if (started || cell) rows.push([...row, cell]);
  return rows;
}

function mdCell(value: string | number | null): string {
  return value === null ? "" : String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function toMarkdown(apps: Application[]): string {
  const counts = STATUSES.map((s) => `${apps.filter((a) => a.status === s).length} ${s}`).join(", ");
  const head = ["Company", "Role", "Type", "Status", "Deadline", "Interview", "Source", "Notes"];
  const lines = [
    `# Job applications`,
    "",
    `${apps.length} ${apps.length === 1 ? "application" : "applications"}: ${counts}.`,
    "",
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...apps.map(
      (a) =>
        `| ${[a.company, a.role, a.type, a.status, a.deadline, a.interview_date, a.source, a.notes].map(mdCell).join(" | ")} |`,
    ),
  ];
  return lines.join("\n") + "\n";
}
