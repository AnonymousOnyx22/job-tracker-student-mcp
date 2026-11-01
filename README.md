# Job Application Tracker MCP

[![npm](https://img.shields.io/npm/v/job-tracker-student-mcp.svg)](https://www.npmjs.com/package/job-tracker-student-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Star on GitHub](https://img.shields.io/github/stars/AnonymousOnyx22/job-tracker-student-mcp.svg)](https://github.com/AnonymousOnyx22/job-tracker-student-mcp)

Too many job applications spread across tabs and notes. Track them in one place offline.

```bash
npx -y job-tracker-student-mcp
```

**Try these prompts:**

1. "Add a Software Intern role at Shopify with a deadline of 2026-11-15, found on LinkedIn."
2. "Move application 1 to interview on 2026-11-20 at 14:30."
3. "What deadlines and interviews do I have in the next two weeks?"

A free, open source [MCP](https://modelcontextprotocol.io) server named `job-tracker-student-mcp` on npm. Track internships, jobs, interviews and deadlines, see what is coming up, and export your list as CSV or Markdown. Runs on your computer with Claude Desktop, Claude Code, Cursor, VS Code and Windsurf. No internet, no login, no API keys. Your applications are saved in one JSON file that you can open, back up or delete.

## Install

Run it straight from npm with `npx`. You need Node.js 20 or newer, see [Node version](#node-version) for the details. There is nothing else to install and no account to make.

```bash
npx -y job-tracker-student-mcp
```

Add it to your app's MCP config so the app can start it for you. Every app reads its config from its own file, so pick yours:

- [Claude Desktop](#claude-desktop)
- [Claude Code](#claude-code)
- [Cursor](#cursor)
- [VS Code](#vs-code)
- [Windsurf](#windsurf)

All of them start the same server the same way. The only difference is where the config goes.

### Claude Desktop

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "job-tracker": {
      "command": "npx",
      "args": ["-y", "job-tracker-student-mcp"]
    }
  }
}
```

Restart Claude Desktop after you save the file.

### Claude Code

Run this in a terminal:

```bash
claude mcp add job-tracker -- npx -y job-tracker-student-mcp
```

### Cursor

Cursor reads `.cursor/mcp.json` from the project folder, or `~/.cursor/mcp.json` from your home folder if you want the server in every project.

```json
{
  "mcpServers": {
    "job-tracker": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "job-tracker-student-mcp"]
    }
  }
}
```

Restart Cursor after you save the file.

### VS Code

Put this in `.vscode/mcp.json` in your project folder, or in the `mcp.json` file in your user profile:

```json
{
  "servers": {
    "job-tracker": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "job-tracker-student-mcp"]
    }
  }
}
```

Restart VS Code after you save the file.

### Windsurf

Add this to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "job-tracker": {
      "command": "npx",
      "args": ["-y", "job-tracker-student-mcp"]
    }
  }
}
```

Refresh the plugins list in Windsurf after you save the file.

After any of these, try one of the prompts below.

## Try these three prompts

1. Add an application

   > "Add a Software Intern role at Shopify with a deadline of 2026-11-15, found on LinkedIn."

   The assistant calls `add_application` with `company` "Shopify", `role` "Software Intern", `deadline` "2026-11-15" and `source` "LinkedIn". It is saved as application 1 in the applied stage.

2. Move it along

   > "Move application 1 to interview on 2026-11-20 at 14:30."

   `update_status` sets the status to interview and keeps the interview date, so it shows up in your reminders.

3. See what is coming

   > "What deadlines and interviews do I have in the next two weeks?"

   `list_upcoming` lists deadlines of open applications and interview dates, earliest first, with a reminder such as "due tomorrow" or "overdue by 2 days".

More things you can ask:

- "Export all my applications as a CSV."
- "Show only my offers as a Markdown table."
- "Which deadlines have already passed?"
- "Delete application 3, it was a duplicate."
- "Which applications mention a referral?"
- "Which applications have a deadline in November 2026?"

## Tools

There are seven tools. `list_applications`, `list_upcoming` and `export_report` are read only. `add_application`, `update_application`, `update_status` and `delete_application` write to the local JSON file and nothing else.

| Tool | What it does | Parameters | Example prompt |
| --- | --- | --- | --- |
| `add_application` | Add a job or internship with company, role, deadline and source. | `company`, `role`, `deadline`, `source`, `type`, `status`, `notes` | "Add a Software Intern role at Shopify with a deadline of 2026-11-15, found on LinkedIn." |
| `update_status` | Move an application between applied, interview, offer and rejected. | `id`, `status`, `interview_date`, `note` | "Move application 1 to interview on 2026-11-20 at 14:30." |
| `update_application` | Update the deadline, notes, role, company, type, source or interview date of an existing application. | `id`, `company`, `role`, `deadline`, `notes`, `type`, `source`, `interview_date` | "Update application 1 to set the deadline to 2026-11-20 and add a note about the referral." |
| `delete_application` | Remove a duplicate or mistaken application for good. | `id` | "Delete application 3, it was a duplicate." |
| `list_applications` | List applications with optional status, company, text query and deadline range filters to see ids. The query searches role, notes and source. The result also has counts per stage in `summary_counts`. Use `sort` to order by deadline, company or id. | `status`, `company`, `query`, `deadline_after`, `deadline_before`, `sort` | "Show my applications by nearest deadline." |
| `list_upcoming` | Show upcoming deadlines and interviews sorted by date, with reminders. | `days`, `include_overdue`, `today` | "What deadlines and interviews do I have in the next two weeks?" |
| `export_report` | Export applications as CSV or Markdown. | `format`, `status` | "Export all my applications as a CSV." |

Dates are written as YYYY-MM-DD. An interview can also have a time, written as YYYY-MM-DDTHH:MM.

## Where your data lives

Applications are saved in `~/.job-tracker-student-mcp/applications.json`. Set the `JOB_TRACKER_FILE` environment variable to use another path. Add it in the `env` part of your MCP config:

```json
{
  "mcpServers": {
    "job-tracker": {
      "command": "npx",
      "args": ["-y", "job-tracker-student-mcp"],
      "env": { "JOB_TRACKER_FILE": "C:\\Users\\you\\Documents\\applications.json" }
    }
  }
}
```

## Comparison

This tracker is built for job applications. Some servers focus on course or learning management systems, and some are general task trackers.

Compared with course focused servers, this one works offline with no login to a learning system and no keys. It is job specific, with statuses for applied, interview, offer and rejected, and it tracks deadlines and interview dates with reminders.

Compared with generic task MCP servers, it is focused on job applications rather than general todos. It keeps applications in a simple local JSON file, has read only and write tools for this specific workflow, and can export as CSV or Markdown. Everything runs locally with no account or network calls.

## Privacy

The server makes no network calls and has no API keys, passwords or accounts. It reads and writes the one JSON file above and nothing else. There is no telemetry. What you tell the assistant in a chat is handled by the app you use, not by this server.

## FAQ

**Does it send reminders on its own?** No. MCP servers answer when asked. `list_upcoming` gives you the reminders when you ask, so a good habit is to start the week with "what is coming up?".

**Which applications show up in `list_upcoming`?** Deadlines of applications in the applied stage, and interview dates of applications in the interview stage. Offers and rejected applications are left out.

**Can I use it on two computers?** Point `JOB_TRACKER_FILE` at a file in a folder you already sync, and both computers read the same list. Do not use both at the same moment.

## Troubleshooting

If `npx -y job-tracker-student-mcp` fails or hangs:

- Check your Node.js version with `node --version`. The server needs Node.js 20 or newer, see [Node version](#node-version).
- Delete the folder where npx keeps its downloads, then try again. On Windows it is `%LocalAppData%\npm-cache\_npx`, and on macOS and Linux it is `~/.npm/_npx`.
- Make sure your computer can reach `registry.npmjs.org`. On a school or work network, npm may need proxy settings from the network's owner.
- If `node` or `npx` is not found on Windows, reinstall Node.js with "Add to PATH" checked, then restart your terminal.

If a tool says the file is not valid JSON, open the file named in the message and fix it, or move it away to start a fresh list.

## Node version

There are two floors here, and they are not the same number.

| What you are doing | Node.js |
| --- | --- |
| Running the published server | 20 or newer |
| Building and testing a clone | 22.12 or newer, on the 22 and 24 release lines or 26 and later |

The server itself is happy on Node.js 20, and that is what `engines` in package.json says. The test runner wants a newer Node.js, so the development floor lives in `devEngines` in the same file. npm checks `devEngines` before install, run and test, so a clone on Node.js 20 stops with a clear message instead of a strange failure part way through the test suite. The 23 and 25 release lines are left out on purpose, because the test runner does not run on them.

Both numbers live in package.json, and a test in `tests/node-version.test.ts` keeps them in step with the README and with the range the test runner asks for.

## Development

```bash
npm install
npm run build
npm test
```

The tests call every tool through a real MCP client and save to a temporary folder, so they need no account or network. They need the newer Node.js from the Node version section above, because of the test runner.

## More free student MCP servers

All free, open source and read only where they touch your accounts. Browse the full list at [brightspacemcp.com/more-mcps](https://brightspacemcp.com/more-mcps/).

| Server | What it does |
| --- | --- |
| [Brightspace MCP](https://github.com/AnonymousOnyx22/brightspace-d2l-mcp) | D2L Brightspace for AI. Due dates with real submission status, grades, a target grade calculator and course files. |
| [Canvas MCP](https://github.com/AnonymousOnyx22/canvas-lms-student-mcp) | Canvas LMS for AI, read only. Due dates, missing work, grades and announcements. |
| [Moodle MCP](https://github.com/AnonymousOnyx22/moodle-student-mcp) | Moodle for AI, read only. Due dates, overdue work, grades and announcements. |
| [Google Classroom MCP](https://github.com/AnonymousOnyx22/google-classroom-student-mcp) | Google Classroom for AI, read only. Todos, due dates, missing work and grades. |
| [GPA Calculator MCP](https://github.com/AnonymousOnyx22/gpa-calculator-mcp) | GPA, grade conversion and the grade you need on the final, for AI. Works offline, no account. |
| [Citations MCP](https://github.com/AnonymousOnyx22/student-citations-mcp) | APA, MLA and Chicago citations from a DOI, an ISBN or typed details. No account. |
| [Study Planner MCP](https://github.com/AnonymousOnyx22/study-planner-mcp) | Exam study schedules, spaced repetition dates, pomodoro plans and assignment milestones. Works offline. |
| [Paper Finder MCP](https://github.com/AnonymousOnyx22/paper-finder-student-mcp) | Search scholarly papers, find open access copies and related work through OpenAlex. No key needed. |
| [BibTeX Reference Manager MCP](https://github.com/AnonymousOnyx22/bibtex-reference-manager-mcp) | Clean, convert, dedupe and lint BibTeX, RIS and CSL JSON reference lists, and make cite keys. Works offline. |
| [Open Textbook Finder MCP](https://github.com/AnonymousOnyx22/open-textbook-finder-mcp) | Find free legal copies of textbooks on OpenStax, DOAB and Open Library, look up editions by ISBN and suggest cheaper older ones. |
| [STEM Calculator MCP](https://github.com/AnonymousOnyx22/stem-calc-student-mcp) | Chemistry and physics homework math: molar mass, balancing equations, grams to moles, unit conversion and significant figures. Works offline. |
| [Essay Stats MCP](https://github.com/AnonymousOnyx22/essay-stats-mcp) | Offline writing metrics for essays. Word and page counts, readability scores, passive voice, repeated openers, filler words, long sentences and word limit checks, so students can check their work against assignment requirements. No account, no network. |
| [Syllabus to Calendar MCP](https://github.com/AnonymousOnyx22/syllabus-calendar-mcp) | Syllabus to calendar MCP server. Extract dates from syllabus text, build an ics calendar, expand recurring classes and merge calendars. Works offline, no account. |

## License

MIT
