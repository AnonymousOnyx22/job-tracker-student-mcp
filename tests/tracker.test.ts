import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Store, daysBetween, isDate, toCsv } from "../src/tracker.js";
import { run, tempStore } from "./helpers.js";

let store: Store;
beforeEach(() => {
  store = tempStore();
});

const add = (args: Record<string, unknown>) => run(store, "add_application", args);

describe("add_application", () => {
  it("warns about a duplicate company, role and deadline but still saves it", async () => {
    const first = await add({ company: "Shopify", role: "Software Intern", deadline: "2026-11-15" });
    expect(first.structured.warning).toBeUndefined();
    const second = await add({ company: "shopify", role: "Software Intern", deadline: "2026-11-15" });
    expect(second.structured.warning).toContain("#1");
    expect(store.list()).toHaveLength(2);
    const other = await add({ company: "Shopify", role: "Software Intern", deadline: "2026-12-01" });
    expect(other.structured.warning).toBeUndefined();
  });

  it("saves an application in the applied stage and gives it an id", async () => {
    const out = await add({ company: "Shopify", role: "Software Intern", deadline: "2026-11-15", source: "LinkedIn", type: "internship" });
    expect(out.structured.application).toMatchObject({
      id: 1,
      company: "Shopify",
      role: "Software Intern",
      type: "internship",
      status: "applied",
      deadline: "2026-11-15",
      source: "LinkedIn",
      interview_date: null,
    });
    expect(out.text).toContain("#1 Software Intern at Shopify");
    expect(out.text).toContain("deadline 2026-11-15");
    expect(store.list()).toHaveLength(1);
  });

  it("writes the file on disk and numbers the next application 2", async () => {
    await add({ company: "A", role: "One" });
    const second = await add({ company: "B", role: "Two" });
    expect((second.structured.application as { id: number }).id).toBe(2);
    expect(JSON.parse(readFileSync(store.path, "utf8"))).toHaveLength(2);
  });

  it("defaults to a job with no deadline, source or notes", async () => {
    const out = await add({ company: "Acme", role: "Analyst" });
    expect(out.structured.application).toMatchObject({ type: "job", deadline: null, source: null, notes: null });
  });

  it("does not reuse the id of an application that is gone from the list", async () => {
    await add({ company: "A", role: "One" });
    await add({ company: "B", role: "Two" });
    store.save(store.list().filter((a) => a.id !== 1));
    const out = await add({ company: "C", role: "Three" });
    expect((out.structured.application as { id: number }).id).toBe(3);
  });

  it("trims blanks and keeps notes", async () => {
    const out = await add({ company: "  Acme  ", role: " Analyst ", notes: "  referred by Sam ", source: "   " });
    expect(out.structured.application).toMatchObject({ company: "Acme", role: "Analyst", notes: "referred by Sam", source: null });
  });

  it("accepts another starting status", async () => {
    const out = await add({ company: "Acme", role: "Analyst", status: "offer" });
    expect((out.structured.application as { status: string }).status).toBe("offer");
  });

  it("rejects a deadline that is not a real date and saves nothing", async () => {
    await expect(add({ company: "Acme", role: "Analyst", deadline: "2026-02-30" })).rejects.toThrow(/not a real date/);
    await expect(add({ company: "Acme", role: "Analyst", deadline: "Nov 15" })).rejects.toThrow(/YYYY-MM-DD/);
    expect(store.list()).toHaveLength(0);
  });

  it("rejects a blank company", async () => {
    await expect(add({ company: "   ", role: "Analyst" })).rejects.toThrow(/are not blank/);
    await expect(add({ company: "", role: "Analyst" })).rejects.toThrow();
  });

  it("rejects a blank company or role on update and keeps the old values", async () => {
    await add({ company: "Acme", role: "Analyst" });
    await expect(run(store, "update_application", { id: 1, company: "   " })).rejects.toThrow(/are not blank/);
    await expect(run(store, "update_application", { id: 1, role: "  ", notes: "x" })).rejects.toThrow(/are not blank/);
    expect(store.list()[0]).toMatchObject({ company: "Acme", role: "Analyst" });
  });
});

describe("update_status", () => {
  beforeEach(async () => {
    await add({ company: "Shopify", role: "Software Intern", deadline: "2026-11-15" });
  });

  it("moves an application and reports where it came from", async () => {
    const out = await run(store, "update_status", { id: 1, status: "interview", interview_date: "2026-11-20T14:30" });
    expect(out.text).toBe("#1 Software Intern at Shopify moved from applied to interview, interview 2026-11-20T14:30.");
    expect(out.structured.previous_status).toBe("applied");
    expect(store.list()[0]).toMatchObject({ status: "interview", interview_date: "2026-11-20T14:30" });
  });

  it("walks through every stage", async () => {
    for (const status of ["interview", "offer", "rejected", "applied"] as const) {
      await run(store, "update_status", { id: 1, status });
      expect(store.list()[0].status).toBe(status);
    }
  });

  it("says so when the status does not change", async () => {
    const out = await run(store, "update_status", { id: 1, status: "applied" });
    expect(out.text).toContain("stays applied");
  });

  it("adds a note to the notes", async () => {
    await run(store, "update_status", { id: 1, status: "interview", note: "phone screen" });
    await run(store, "update_status", { id: 1, status: "offer", note: "got the offer" });
    expect(store.list()[0].notes).toBe("phone screen; got the offer");
  });

  it("keeps the interview date when the status moves on", async () => {
    await run(store, "update_status", { id: 1, status: "interview", interview_date: "2026-11-20" });
    await run(store, "update_status", { id: 1, status: "offer" });
    expect(store.list()[0].interview_date).toBe("2026-11-20");
  });

  it("names the problem for an unknown id", async () => {
    await expect(run(store, "update_status", { id: 99, status: "offer" })).rejects.toThrow("There is no application with id 99");
  });

  it("rejects an unknown status and a bad interview date without changing anything", async () => {
    await expect(run(store, "update_status", { id: 1, status: "ghosted" })).rejects.toThrow();
    await expect(run(store, "update_status", { id: 1, status: "interview", interview_date: "2026-11-20T25:00" })).rejects.toThrow(/not valid/);
    expect(store.list()[0].status).toBe("applied");
  });
});

describe("update_application", () => {
  beforeEach(async () => {
    await add({ company: "Shopify", role: "Software Intern", deadline: "2026-11-15", notes: "old note", source: "LinkedIn" });
  });

  it("updates only the fields that are passed", async () => {
    const out = await run(store, "update_application", { id: 1, company: "  Stripe  ", deadline: "2026-12-01" });
    expect(out.text).toBe("Updated #1 Software Intern at Stripe.");
    expect(out.structured.application).toMatchObject({ id: 1, company: "Stripe", role: "Software Intern", deadline: "2026-12-01", notes: "old note" });
  });

  it("replaces notes and updates role", async () => {
    const out = await run(store, "update_application", { id: 1, role: "Backend Intern", notes: "new note" });
    expect(store.list()[0]).toMatchObject({ role: "Backend Intern", notes: "new note" });
    expect(out.structured.application).toMatchObject({ role: "Backend Intern", notes: "new note" });
  });

  it("changes type and source, and clears source with an empty string", async () => {
    await run(store, "update_application", { id: 1, type: "internship", source: "Career fair" });
    expect(store.list()[0]).toMatchObject({ type: "internship", source: "Career fair" });
    await run(store, "update_application", { id: 1, source: "" });
    expect(store.list()[0]).toMatchObject({ type: "internship", source: null });
  });

  it("rejects an unknown type", async () => {
    await expect(run(store, "update_application", { id: 1, type: "volunteer" })).rejects.toThrow();
  });

  it("clears the deadline with an empty string", async () => {
    await run(store, "update_application", { id: 1, deadline: "" });
    expect(store.list()[0].deadline).toBeNull();
  });

  it("changes and clears the interview date", async () => {
    await run(store, "update_application", { id: 1, interview_date: "2026-11-21T10:00" });
    expect(store.list()[0].interview_date).toBe("2026-11-21T10:00");
    await run(store, "update_application", { id: 1, interview_date: "" });
    expect(store.list()[0].interview_date).toBeNull();
  });

  it("rejects a bad interview date and changes nothing", async () => {
    await expect(run(store, "update_application", { id: 1, interview_date: "2026-11-20T25:00" })).rejects.toThrow(/not valid/);
    expect(store.list()[0].interview_date).toBeNull();
  });

  it("rejects a bad deadline and changes nothing", async () => {
    await expect(run(store, "update_application", { id: 1, deadline: "Nov 15" })).rejects.toThrow(/YYYY-MM-DD/);
    expect(store.list()[0].deadline).toBe("2026-11-15");
  });

  it("rejects a bad deadline that is not a real date", async () => {
    await expect(run(store, "update_application", { id: 1, deadline: "2026-02-30" })).rejects.toThrow(/not a real date/);
    expect(store.list()[0].deadline).toBe("2026-11-15");
  });

  it("names the problem for an unknown id", async () => {
    await expect(run(store, "update_application", { id: 99, company: "X" })).rejects.toThrow("There is no application with id 99");
  });

  it("rejects an empty role string", async () => {
    await expect(run(store, "update_application", { id: 1, role: "" })).rejects.toThrow();
  });
});

describe("list_upcoming", () => {
  const TODAY = "2026-11-10";
  const ids = (out: { structured: Record<string, unknown> }) => (out.structured.items as { id: number }[]).map((i) => i.id);

  beforeEach(async () => {
    await add({ company: "Far", role: "Later", deadline: "2026-12-30" });
    await add({ company: "Soon", role: "Tomorrow", deadline: "2026-11-11" });
    await add({ company: "Late", role: "Missed", deadline: "2026-11-08" });
    await add({ company: "Talk", role: "Interviewee" });
    await run(store, "update_status", { id: 4, status: "interview", interview_date: "2026-11-10T09:00" });
    await add({ company: "Done", role: "Rejected", deadline: "2026-11-12" });
    await run(store, "update_status", { id: 5, status: "rejected" });
  });

  it("sorts deadlines and interviews by date and leaves out closed applications", async () => {
    const out = await run(store, "list_upcoming", { today: TODAY });
    const items = out.structured.items as { kind: string; reminder: string; days_left: number }[];
    expect(ids(out)).toEqual([3, 4, 2]);
    expect(items.map((i) => i.kind)).toEqual(["deadline", "interview", "deadline"]);
    expect(items.map((i) => i.reminder)).toEqual(["overdue by 2 days", "due today", "due tomorrow"]);
    expect(items.map((i) => i.days_left)).toEqual([-2, 0, 1]);
    expect(out.text).toContain("3 upcoming in the next 14 days");
  });

  it("hides overdue items when asked", async () => {
    expect(ids(await run(store, "list_upcoming", { today: TODAY, include_overdue: false }))).toEqual([4, 2]);
  });

  it("widens and narrows the window with days", async () => {
    expect(ids(await run(store, "list_upcoming", { today: TODAY, days: 60 }))).toEqual([3, 4, 2, 1]);
    expect(ids(await run(store, "list_upcoming", { today: TODAY, days: 0 }))).toEqual([3, 4]);
  });

  it("sorts a deadline before an interview time on the same day", async () => {
    await add({ company: "Same", role: "Day", deadline: "2026-11-10" });
    expect(ids(await run(store, "list_upcoming", { today: TODAY, include_overdue: false }))).toEqual([6, 4, 2]);
  });

  it("says when nothing is coming up", async () => {
    const out = await run(tempStore(), "list_upcoming", { today: TODAY });
    expect(out.text).toBe("Nothing coming up in the next 14 days from 2026-11-10.");
    expect(out.structured.items).toEqual([]);
  });

  it("uses today on this computer by default and rejects a bad today", async () => {
    const out = await run(store, "list_upcoming", {});
    expect(out.structured.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(run(store, "list_upcoming", { today: "tomorrow" })).rejects.toThrow(/Use YYYY-MM-DD, for example 2026-11-15/);
  });
});

describe("export_report", () => {
  beforeEach(async () => {
    await add({ company: "Shopify", role: "Software Intern", deadline: "2026-11-15", source: "LinkedIn", type: "internship" });
    await add({ company: 'Smith, "Jones" & Co', role: "Analyst", notes: "line one\nline two | pipe" });
    await run(store, "update_status", { id: 2, status: "offer" });
  });

  it("exports Markdown by default, with a summary line and one row per application", async () => {
    const out = await run(store, "export_report");
    const content = out.structured.content as string;
    expect(out.structured).toMatchObject({ format: "markdown", count: 2 });
    expect(content).toContain("# Job applications");
    expect(content).toContain("2 applications: 1 applied, 0 interview, 1 offer, 0 rejected.");
    expect(content).toContain("| Shopify | Software Intern | internship | applied | 2026-11-15 |  | LinkedIn |  |");
    expect(content).toContain("line one line two \\| pipe");
  });

  it("exports CSV with a header, quotes and escaped quotes", async () => {
    const out = await run(store, "export_report", { format: "csv" });
    const content = out.structured.content as string;
    const lines = content.split("\n");
    expect(lines[0]).toBe("id,company,role,type,status,deadline,interview_date,source,notes,added,updated");
    expect(lines[1].startsWith("1,Shopify,Software Intern,internship,applied,2026-11-15,,LinkedIn,,")).toBe(true);
    expect(content).toContain('"Smith, ""Jones"" & Co"');
    expect(content).toContain('"line one\nline two | pipe"');
  });

  it("filters by status", async () => {
    const out = await run(store, "export_report", { format: "csv", status: "offer" });
    expect(out.structured.count).toBe(1);
    expect(out.text).toContain("Exported 1 application in the offer stage as csv.");
    expect(out.structured.content).not.toContain("Shopify");
  });

  it("guards CSV cells that would run as a formula", () => {
    const csv = toCsv([
      { id: 1, company: '=HYPERLINK("x")', role: "+1", type: "job", status: "applied", deadline: null, interview_date: null, source: "@home", notes: "-5", added: "2026-01-01", updated: "2026-01-01" },
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")",'+1`);
    expect(csv).toContain(",'@home,'-5,");
  });

  it("exports a header only when there is nothing to export", async () => {
    const out = await run(tempStore(), "export_report", { format: "csv" });
    expect(out.structured).toMatchObject({ count: 0, content: "id,company,role,type,status,deadline,interview_date,source,notes,added,updated\n" });
    const md = await run(tempStore(), "export_report");
    expect(md.text).toContain("0 applications");
  });
});

describe("import_applications", () => {
  it("imports rows, skips bad ones and warns about duplicates", async () => {
    await add({ company: "Shopify", role: "Software Intern", deadline: "2026-11-15" });
    const csv = [
      "Company,Role,Type,Deadline,Notes,Extra",
      'shopify,Software Intern,internship,2026-11-15,"said ""hi"", twice",x',
      "Acme,,job,,,",
      "Acme,Dev,job,2026-13-40,,",
      "Acme,Dev,tutor,,,",
      "Globex,Analyst,,,,",
    ].join("\r\n");
    const out = await run(store, "import_applications", { csv });
    expect(out.structured.imported).toBe(2);
    const skipped = out.structured.skipped as { row: number }[];
    expect(skipped.map((s) => s.row)).toEqual([3, 4, 5]);
    expect((out.structured.warnings as string[])[0]).toContain("#1");
    expect(store.list().map((a) => a.id)).toEqual([1, 2, 3]);
    expect(store.list()[1]).toMatchObject({ type: "internship", notes: 'said "hi", twice' });
    expect(store.list()[2]).toMatchObject({ company: "Globex", type: "job", status: "applied" });
  });

  it("reads back the CSV from export_report", async () => {
    await add({ company: "Shopify", role: "Intern", notes: "=SUM(1)" });
    const exported = (await run(store, "export_report", { format: "csv" })).structured.content;
    const other = tempStore();
    await run(other, "import_applications", { csv: exported });
    expect(other.list()[0]).toMatchObject({ company: "Shopify", role: "Intern", notes: "=SUM(1)" });
  });

  it("rejects a CSV without company and role columns or with an open quote", async () => {
    await expect(run(store, "import_applications", { csv: "name,title\nA,B\n" })).rejects.toThrow("company and role");
    await expect(run(store, "import_applications", { csv: 'company,role\n"A,B\n' })).rejects.toThrow("never closed");
  });
});

describe("delete_application", () => {
  beforeEach(async () => {
    await add({ company: "Shopify", role: "Intern" });
    await add({ company: "Google", role: "Dev" });
  });

  it("removes the application and keeps the other ids", async () => {
    const out = await run(store, "delete_application", { id: 1 });
    expect(out.text).toContain("Deleted #1 Intern at Shopify");
    expect(out.structured.deleted).toMatchObject({ id: 1, company: "Shopify" });
    expect(store.list().map((a) => a.id)).toEqual([2]);
  });

  it("names the problem for an unknown id", async () => {
    await expect(run(store, "delete_application", { id: 99 })).rejects.toThrow("There is no application with id 99");
    await expect(run(store, "delete_application", { id: 99 })).rejects.toThrow("The closest ids are 1, 2. Call list_applications");
    expect(store.list()).toHaveLength(2);
  });

  it("writes the shorter list to the file on disk", async () => {
    await run(store, "delete_application", { id: 2 });
    const saved = JSON.parse(readFileSync(store.path, "utf8")) as { id: number }[];
    expect(saved.map((a) => a.id)).toEqual([1]);
  });

  it("does not hand the id of a deleted application to a different one", async () => {
    await run(store, "delete_application", { id: 1 });
    const out = await add({ company: "C", role: "Three" });
    expect((out.structured.application as { id: number }).id).toBe(3);
    expect(store.list().map((a) => a.id)).toEqual([2, 3]);
  });

  it("keeps ids unique when the newest application is deleted and another is added", async () => {
    await run(store, "delete_application", { id: 2 });
    const out = await add({ company: "C", role: "Three" });
    const ids = store.list().map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect((out.structured.application as { company: string }).company).toBe("C");
  });

  it("errors the second time the same id is deleted", async () => {
    await run(store, "delete_application", { id: 1 });
    await expect(run(store, "delete_application", { id: 1 })).rejects.toThrow("There is no application with id 1");
    expect(store.list().map((a) => a.id)).toEqual([2]);
  });

  it("points to list_applications in the unknown id error", async () => {
    await expect(run(store, "delete_application", { id: 99 })).rejects.toThrow("list_applications");
  });
});

describe("list_applications", () => {
  beforeEach(async () => {
    await add({ company: "Shopify", role: "Software Intern" });
    await add({ company: "Stripe", role: "Analyst" });
    await add({ company: "Shopify Labs", role: "Developer" });
    await run(store, "update_status", { id: 2, status: "offer" });
  });

  it("lists every application with its id, in id order", async () => {
    const out = await run(store, "list_applications");
    const apps = out.structured.applications as { id: number }[];
    expect(out.structured.count).toBe(3);
    expect(apps.map((a) => a.id)).toEqual([1, 2, 3]);
    expect(out.text).toContain("#2 Analyst at Stripe [offer]");
  });

  it("counts the matching applications per stage", async () => {
    const all = await run(store, "list_applications");
    expect(all.structured.summary_counts).toEqual({ applied: 2, interview: 0, offer: 1, rejected: 0 });
    const shopify = await run(store, "list_applications", { company: "shopify" });
    expect(shopify.structured.summary_counts).toEqual({ applied: 2, interview: 0, offer: 0, rejected: 0 });
  });

  it("filters by status", async () => {
    const out = await run(store, "list_applications", { status: "offer" });
    expect(out.structured.count).toBe(1);
    expect(out.text).toContain("in the offer stage");
  });

  it("filters by company, ignoring case", async () => {
    const out = await run(store, "list_applications", { company: "  SHOPIFY " });
    expect((out.structured.applications as { id: number }[]).map((a) => a.id)).toEqual([1, 3]);
  });

  it("combines both filters and reports none found", async () => {
    const out = await run(store, "list_applications", { status: "offer", company: "shopify" });
    expect(out.structured.count).toBe(0);
    expect(out.text).toContain("None.");
  });

  it("searches role, notes and source with a text query", async () => {
    await add({ company: "Acme", role: "Designer", source: "LinkedIn", notes: "Got a Referral from Sam" });
    const byNotes = await run(store, "list_applications", { query: " referral " });
    expect((byNotes.structured.applications as { id: number }[]).map((a) => a.id)).toEqual([4]);
    const bySource = await run(store, "list_applications", { query: "linkedin" });
    expect(bySource.structured.count).toBe(1);
    const byRole = await run(store, "list_applications", { query: "analyst", status: "offer" });
    expect(byRole.structured.count).toBe(1);
    const none = await run(store, "list_applications", { query: "nothing like this" });
    expect(none.structured.count).toBe(0);
  });

  it("filters by an inclusive deadline range and skips applications without a deadline", async () => {
    await add({ company: "A", role: "R1", deadline: "2026-11-01" });
    await add({ company: "B", role: "R2", deadline: "2026-11-30" });
    await add({ company: "C", role: "R3", deadline: "2026-12-05" });
    const ids = (o: { structured: Record<string, unknown> }) => (o.structured.applications as { id: number }[]).map((a) => a.id);
    expect(ids(await run(store, "list_applications", { deadline_after: "2026-11-01", deadline_before: "2026-11-30" }))).toEqual([4, 5]);
    expect(ids(await run(store, "list_applications", { deadline_after: "2026-11-02" }))).toEqual([5, 6]);
    expect(ids(await run(store, "list_applications", { deadline_before: "2026-11-01" }))).toEqual([4]);
    await expect(run(store, "list_applications", { deadline_before: "soon" })).rejects.toThrow("YYYY-MM-DD");
  });

  it("sorts by deadline, company or id", async () => {
    await add({ company: "A", role: "R1", deadline: "2026-12-05" });
    await add({ company: "b", role: "R2", deadline: "2026-11-01" });
    const ids = (o: { structured: Record<string, unknown> }) => (o.structured.applications as { id: number }[]).map((a) => a.id);
    expect(ids(await run(store, "list_applications", { sort: "deadline" }))).toEqual([5, 4, 1, 2, 3]);
    expect(ids(await run(store, "list_applications", { sort: "company" }))).toEqual([4, 5, 1, 3, 2]);
    expect(ids(await run(store, "list_applications", { sort: "id" }))).toEqual([1, 2, 3, 4, 5]);
    expect(ids(await run(store, "list_applications", { sort: "deadline", status: "applied" }))).toEqual([5, 4, 1, 3]);
  });

  it("does not change the saved file", async () => {
    const before = readFileSync(store.path, "utf8");
    await run(store, "list_applications", {});
    expect(readFileSync(store.path, "utf8")).toBe(before);
  });
});

describe("the store and the date helpers", () => {
  it("starts empty when the file does not exist and creates the folder on save", () => {
    expect(store.list()).toEqual([]);
    expect(existsSync(store.path)).toBe(false);
    store.save([]);
    expect(existsSync(store.path)).toBe(true);
  });

  it("explains a file that is not valid JSON or not a list", async () => {
    store.save([]);
    writeFileSync(store.path, "{oops", "utf8");
    await expect(add({ company: "A", role: "B" })).rejects.toThrow(/not valid JSON/);
    writeFileSync(store.path, "{}", "utf8");
    expect(() => store.list()).toThrow(/list of applications/);
  });

  it("checks calendar dates and counts days across month and leap year edges", () => {
    expect(isDate("2028-02-29")).toBe(true);
    expect(isDate("2026-02-29")).toBe(false);
    expect(isDate("2026-13-01")).toBe(false);
    expect(daysBetween("2026-11-10", "2026-11-11")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2026-11-10", "2026-11-08T10:00")).toBe(-2);
  });
});
