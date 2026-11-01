import { z } from "zod";
import { type ToolDef, bullets } from "./core/tools.js";
import { STATUSES, TYPES, type Application, type Status, type Store, checkDeadline, checkWhen, todayOr, toCsv, toMarkdown, upcoming } from "./tracker.js";

type Api = Store;

const appFields = z.object({
  id: z.number().describe("The id of the application."),
  company: z.string().describe("The company."),
  role: z.string().describe("The role."),
  type: z.enum(TYPES).describe("Job or internship."),
  status: z.enum(STATUSES).describe("The stage the application is in."),
  deadline: z.string().nullable().describe("Last day to apply as YYYY-MM-DD, or null."),
  interview_date: z.string().nullable().describe("Interview date as YYYY-MM-DD or YYYY-MM-DDTHH:MM, or null."),
  source: z.string().nullable().describe("Where you found the posting, or null."),
  notes: z.string().nullable().describe("Free notes, or null."),
  added: z.string().describe("The day it was added, YYYY-MM-DD."),
  updated: z.string().describe("The day it last changed, YYYY-MM-DD."),
});

const status = z.enum(STATUSES).describe('The stage: "applied", "interview", "offer" or "rejected".');

const clean = (text: string | undefined): string | null => {
  const t = text?.trim();
  return t ? t : null;
};

const brief = (a: Application) => `#${a.id} ${a.role} at ${a.company}`;

export const tools: ToolDef<Api>[] = [
  {
    name: "add_application",
    title: "Add application",
    readOnly: false,
    description:
      "Add a job or internship to the tracker. It starts in the applied stage unless you pass another status. " +
      "Inputs: company and role (both required), an optional deadline as YYYY-MM-DD, an optional source such as LinkedIn or a career fair, an optional type of job or internship, an optional status and optional notes. " +
      "The tool saves the application on this computer and returns its id, which update_status needs. " +
      "If an application with the same company, role and deadline already exists, the new one is still saved and the result has a warning field. " +
      'Example prompt: "Add a Software Intern role at Shopify with a deadline of 2026-11-15, found on LinkedIn."',
    inputSchema: {
      company: z.string().min(1).describe("Name of the company."),
      role: z.string().min(1).describe("Title of the role."),
      deadline: z.string().optional().describe("Last day to apply as YYYY-MM-DD."),
      source: z.string().optional().describe("Where you found the posting, such as LinkedIn or a career fair."),
      type: z.enum(TYPES).default("job").describe('"job" or "internship". Defaults to "job".'),
      status: status.default("applied"),
      notes: z.string().optional().describe("Anything you want to remember about it."),
    },
    outputSchema: {
      application: appFields.describe("The application that was saved."),
      warning: z.string().optional().describe("Only present when an application with the same company, role and deadline already existed. The new one is still saved."),
    },
    run: async (args, store) => {
      const deadline = args.deadline ? checkDeadline(args.deadline.trim()) : null;
      const apps = store.list();
      const now = todayOr();
      const app: Application = {
        id: apps.reduce((max, a) => Math.max(max, a.id), 0) + 1,
        company: args.company.trim(),
        role: args.role.trim(),
        type: args.type,
        status: args.status,
        deadline,
        interview_date: null,
        source: clean(args.source),
        notes: clean(args.notes),
        added: now,
        updated: now,
      };
      if (!app.company || !app.role) throw new Error("Give a company and a role that are not blank.");
      const same = (s: string) => s.toLowerCase();
      const twin = apps.find((a) => same(a.company) === same(app.company) && same(a.role) === same(app.role) && a.deadline === app.deadline);
      store.save([...apps, app]);
      const extra = [deadline ? `deadline ${deadline}` : null, app.source ? `from ${app.source}` : null].filter(Boolean).join(", ");
      const warning = twin ? `${brief(twin)} has the same company, role and deadline, so this may be a duplicate. Use delete_application if it is.` : undefined;
      return {
        text: `Added ${brief(app)} as ${app.type}, status ${app.status}${extra ? `, ${extra}` : ""}.${warning ? ` Warning: ${warning}` : ""}`,
        structured: warning ? { application: app, warning } : { application: app },
      };
    },
  },
  {
    name: "update_status",
    title: "Update status",
    readOnly: false,
    description:
      "Move an application to another stage: applied, interview, offer or rejected. " +
      "Inputs: id of the application (from add_application or list_applications), the new status, an optional interview_date as YYYY-MM-DD or YYYY-MM-DDTHH:MM, and an optional note that is added to the notes. " +
      "When the status is interview, pass interview_date so list_upcoming can remind you. " +
      'Example prompt: "Move application 1 to interview on 2026-11-20 at 14:30."',
    inputSchema: {
      id: z.number().int().positive().describe("The id of the application."),
      status,
      interview_date: z.string().optional().describe("Interview date as YYYY-MM-DD or YYYY-MM-DDTHH:MM."),
      note: z.string().optional().describe("A note to add to the application."),
    },
    outputSchema: {
      previous_status: z.enum(STATUSES).describe("The stage before this change."),
      application: appFields.describe("The application after the change."),
    },
    run: async (args, store) => {
      const apps = store.list();
      const app = apps.find((a) => a.id === args.id);
      if (!app) throw new Error(`There is no application with id ${args.id}. Use list_applications to see the ids.`);
      const when = args.interview_date ? checkWhen(args.interview_date.trim()) : null;
      const previous: Status = app.status;
      app.status = args.status;
      if (when) app.interview_date = when;
      const note = clean(args.note);
      if (note) app.notes = app.notes ? `${app.notes}; ${note}` : note;
      app.updated = todayOr();
      store.save(apps);
      const moved = previous === app.status ? `stays ${app.status}` : `moved from ${previous} to ${app.status}`;
      const at = app.status === "interview" && app.interview_date ? `, interview ${app.interview_date}` : "";
      return { text: `${brief(app)} ${moved}${at}.`, structured: { previous_status: previous, application: app } };
    },
  },
  {
    name: "update_application",
    title: "Update application",
    readOnly: false,
    description:
      "Update the deadline, notes, role, company, type or source of an existing application. " +
      "Inputs: id of the application (from add_application or list_applications), and any of company, role, deadline as YYYY-MM-DD, notes, type (job or internship) and source. Only the fields you pass are changed; the rest stay the same. " +
      "Pass an empty deadline or an empty source to clear it. " +
      'Example prompt: "Update application 1 to set the deadline to 2026-11-20 and add a note about the referral."',
    inputSchema: {
      id: z.number().int().positive().describe("The id of the application."),
      company: z.string().min(1).optional().describe("New company name."),
      role: z.string().min(1).optional().describe("New role title."),
      deadline: z.string().optional().describe("New deadline as YYYY-MM-DD, or an empty string to clear it."),
      notes: z.string().optional().describe("New notes, replacing the old ones."),
      type: z.enum(TYPES).optional().describe('New type, "job" or "internship".'),
      source: z.string().optional().describe("New source, such as LinkedIn or a career fair, or an empty string to clear it."),
    },
    outputSchema: { application: appFields.describe("The application after the change.") },
    run: async (args, store) => {
      const apps = store.list();
      const app = apps.find((a) => a.id === args.id);
      if (!app) throw new Error(`There is no application with id ${args.id}. Use list_applications to see the ids.`);
      if (args.company !== undefined) app.company = args.company.trim();
      if (args.role !== undefined) app.role = args.role.trim();
      if (args.deadline !== undefined) {
        const d = args.deadline.trim();
        app.deadline = d ? checkDeadline(d) : null;
      }
      if (args.notes !== undefined) app.notes = clean(args.notes);
      if (args.type !== undefined) app.type = args.type;
      if (args.source !== undefined) app.source = clean(args.source);
      app.updated = todayOr();
      store.save(apps);
      return { text: `Updated ${brief(app)}.`, structured: { application: app } };
    },
  },
  {
    name: "delete_application",
    title: "Delete application",
    readOnly: false,
    destructive: true,
    description:
      "Remove an application from the tracker, for example a duplicate or a mistaken entry. " +
      "Inputs: id of the application (from add_application or list_applications). The application is deleted from the local file and cannot be brought back, and the ids of the other applications do not change. " +
      'Example prompt: "Delete application 3, it was a duplicate."',
    inputSchema: {
      id: z.number().int().positive().describe("The id of the application to delete."),
    },
    outputSchema: { deleted: appFields.describe("The application that was removed.") },
    run: async (args, store) => {
      const apps = store.list();
      const app = apps.find((a) => a.id === args.id);
      if (!app) throw new Error(`There is no application with id ${args.id}. Use list_applications to see the ids.`);
      store.save(apps.filter((a) => a.id !== args.id));
      return { text: `Deleted ${brief(app)}.`, structured: { deleted: app } };
    },
  },
  {
    name: "list_applications",
    title: "List applications",
    readOnly: true,
    description:
      "List applications with optional status and company filters, an optional text query and an optional deadline range. " +
      "Inputs: optional status to filter by stage, an optional company substring to match (case insensitive), an optional query that searches the role, notes and source text (case insensitive), for example referral or LinkedIn, and optional deadline_after and deadline_before as YYYY-MM-DD. Both dates are included, and applications without a deadline are left out when you pass either one. " +
      "Returns all matching applications as a structured list with their ids, so you can see application ids without exporting a full report, plus summary_counts with how many of them are in each stage. " +
      'Example prompt: "Which applications have a deadline in November 2026?"',
    inputSchema: {
      status: z.enum(STATUSES).optional().describe("Only list applications in this stage."),
      company: z.string().optional().describe("Only list applications whose company name contains this text (case insensitive)."),
      query: z.string().optional().describe("Only list applications whose role, notes or source contains this text (case insensitive)."),
      deadline_after: z.string().optional().describe("Only list applications with a deadline on or after this YYYY-MM-DD date."),
      deadline_before: z.string().optional().describe("Only list applications with a deadline on or before this YYYY-MM-DD date."),
    },
    outputSchema: {
      count: z.number().describe("How many applications match."),
      applications: z.array(appFields).describe("The matching applications."),
      summary_counts: z
        .object({ applied: z.number(), interview: z.number(), offer: z.number(), rejected: z.number() })
        .describe("How many of the matching applications are in each stage."),
    },
    run: async (args, store) => {
      const after = args.deadline_after?.trim() ? checkDeadline(args.deadline_after.trim()) : null;
      const before = args.deadline_before?.trim() ? checkDeadline(args.deadline_before.trim()) : null;
      const all = store.list();
      let apps = all;
      if (args.status) apps = apps.filter((a) => a.status === args.status);
      if (args.company && args.company.trim()) {
        const needle = args.company.trim().toLowerCase();
        apps = apps.filter((a) => a.company.toLowerCase().includes(needle));
      }
      const query = args.query ? args.query.trim().toLowerCase() : "";
      if (query) {
        apps = apps.filter((a) => [a.role, a.notes, a.source].some((f) => (f ?? "").toLowerCase().includes(query)));
      }
      if (after) apps = apps.filter((a) => a.deadline !== null && a.deadline >= after);
      if (before) apps = apps.filter((a) => a.deadline !== null && a.deadline <= before);
      apps = [...apps].sort((a, b) => a.id - b.id);
      const summary_counts = { applied: 0, interview: 0, offer: 0, rejected: 0 };
      for (const a of apps) summary_counts[a.status]++;
      const label = args.status ? ` in the ${args.status} stage` : "";
      const comp = (args.company && args.company.trim() ? ` for company matching "${args.company.trim()}"` : "") + (query ? ` with "${args.query!.trim()}" in the role, notes or source` : "") + (after ? ` with a deadline on or after ${after}` : "") + (before ? ` with a deadline on or before ${before}` : "");
      return {
        text: `Found ${apps.length} ${apps.length === 1 ? "application" : "applications"}${label}${comp}.\n\n${apps.map((a) => `#${a.id} ${a.role} at ${a.company} [${a.status}]`).join("\n") || "None."}`,
        structured: { count: apps.length, applications: apps, summary_counts },
      };
    },
  },
  {
    name: "list_upcoming",
    title: "List upcoming",
    readOnly: true,
    description:
      "Show upcoming deadlines and interviews sorted by date, with a reminder for each one. " +
      "Deadlines come from applications still in the applied stage, and interviews come from applications in the interview stage that have an interview_date. Rejected applications and offers are left out. " +
      "Inputs: optional days, how far ahead to look (default 14), include_overdue (default true) to also show deadlines that already passed, and an optional today as YYYY-MM-DD to ask as if it were another day. " +
      'Example prompt: "What deadlines and interviews do I have in the next two weeks?"',
    inputSchema: {
      days: z.number().int().min(0).max(3650).default(14).describe("How many days ahead to look. Defaults to 14."),
      include_overdue: z.boolean().default(true).describe("Also show deadlines and interviews that already passed. Defaults to true."),
      today: z.string().optional().describe("Treat this YYYY-MM-DD date as today. Defaults to today on this computer."),
    },
    outputSchema: {
      today: z.string().describe("The date used as today, YYYY-MM-DD."),
      items: z
        .array(
          z.object({
            id: z.number().describe("The id of the application."),
            company: z.string().describe("The company."),
            role: z.string().describe("The role."),
            kind: z.enum(["deadline", "interview"]).describe("Whether the date is a deadline or an interview."),
            when: z.string().describe("The date, YYYY-MM-DD or YYYY-MM-DDTHH:MM."),
            days_left: z.number().describe("Days from today. Negative when it is overdue."),
            reminder: z.string().describe("The reminder in words."),
          }),
        )
        .describe("The upcoming items, earliest first."),
    },
    run: async (args, store) => {
      const today = todayOr(args.today);
      const items = upcoming(store.list(), today, args.days, args.include_overdue);
      const lines = items.map((i) => `${i.when}: ${i.kind} for #${i.id} ${i.role} at ${i.company} (${i.reminder})`);
      const head = items.length
        ? `${items.length} upcoming in the next ${args.days} days, from ${today}:`
        : `Nothing coming up in the next ${args.days} days from ${today}.`;
      return { text: items.length ? `${head}\n${bullets(lines)}` : head, structured: { today, items } };
    },
  },
  {
    name: "export_report",
    title: "Export report",
    readOnly: true,
    description:
      "Export your applications as CSV or Markdown so you can share them or open them in a spreadsheet. " +
      "Inputs: format, either csv or markdown (default markdown), and an optional status to export only that stage. " +
      "The report is returned as text and nothing is written to disk. In CSV, a cell that starts with =, +, - or @ gets a leading apostrophe so spreadsheets do not run it as a formula. " +
      'Example prompt: "Export all my applications as a CSV."',
    inputSchema: {
      format: z.enum(["csv", "markdown"]).default("markdown").describe('"csv" or "markdown". Defaults to "markdown".'),
      status: z.enum(STATUSES).optional().describe("Only export applications in this stage."),
    },
    outputSchema: {
      format: z.enum(["csv", "markdown"]).describe("The format of the report."),
      count: z.number().describe("How many applications are in the report."),
      content: z.string().describe("The report itself."),
    },
    run: async (args, store) => {
      const apps = store.list().filter((a) => !args.status || a.status === args.status);
      const content = args.format === "csv" ? toCsv(apps) : toMarkdown(apps);
      const label = args.status ? ` in the ${args.status} stage` : "";
      return {
        text: `Exported ${apps.length} ${apps.length === 1 ? "application" : "applications"}${label} as ${args.format}.\n\n${content}`,
        structured: { format: args.format, count: apps.length, content },
      };
    },
  },
];
