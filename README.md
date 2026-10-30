# Job Application Tracker MCP

[![npm](https://img.shields.io/npm/v/job-application-tracker-mcp.svg)](https://www.npmjs.com/package/job-application-tracker-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Star on GitHub](https://img.shields.io/github/stars/AnonymousOnyx22/job-application-tracker-mcp.svg)](https://github.com/AnonymousOnyx22/job-application-tracker-mcp)

Job Application Tracker MCP is a free, open source [MCP](https://modelcontextprotocol.io) server, named `job-application-tracker-mcp` on npm. It tracks internships, jobs, interviews and deadlines offline, with reminders and status updates. Add an application, move it from applied to interview to offer or rejected, see what is coming up, and export the whole list as CSV or Markdown to share.

Use it with Claude Desktop, Claude Code, Cursor, VS Code and Windsurf. It runs on your computer, needs no internet, no login and no API keys. Your applications are saved in one JSON file that you can open, back up or delete.

Free forever. No account and no subscription.

## Install

Run it straight from npm with `npx`. You need Node.js 20 or newer, see [Node version](#node-version) for the details. There is nothing else to install and no account to make.

```bash
npx -y job-application-tracker-mcp
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
      "args": ["-y", "job-application-tracker-mcp"]
    }
  }
}
```

Restart Claude Desktop after you save the file.

### Claude Code

Run this in a terminal:

```bash
claude mcp add job-tracker -- npx -y job-application-tracker-mcp
```

### Cursor

Cursor reads `.cursor/mcp.json` from the project folder, or `~/.cursor/mcp.json` from your home folder if you want the server in every project.

```json
{
  "mcpServers": {
    "job-tracker": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "job-application-tracker-mcp"]
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
      "args": ["-y", "job-application-tracker-mcp"]
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
      "args": ["-y", "job-application-tracker-mcp"]
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

## Tools

There are four tools. `list_upcoming` and `export_report` are read only. `add_application` and `update_status` write to the local JSON file and nothing else.

| Tool | What it does | Parameters | Example prompt |
| --- | --- | --- | --- |
| `add_application` | Add a job or internship with company, role, deadline and source. | `company`, `role`, `deadline`, `source`, `type`, `status`, `notes` | "Add a Software Intern role at Shopify with a deadline of 2026-11-15, found on LinkedIn." |
| `update_status` | Move an application between applied, interview, offer and rejected. | `id`, `status`, `interview_date`, `note` | "Move application 1 to interview on 2026-11-20 at 14:30." |
| `list_upcoming` | Show upcoming deadlines and interviews sorted by date, with reminders. | `days`, `include_overdue`, `today` | "What deadlines and interviews do I have in the next two weeks?" |
| `export_report` | Export applications as CSV or Markdown. | `format`, `status` | "Export all my applications as a CSV." |

Dates are written as YYYY-MM-DD. An interview can also have a time, written as YYYY-MM-DDTHH:MM.

## Where your data lives

Applications are saved in `~/.job-application-tracker-mcp/applications.json`. Set the `JOB_TRACKER_FILE` environment variable to use another path. Add it in the `env` part of your MCP config:

```json
{
  "mcpServers": {
    "job-tracker": {
      "command": "npx",
      "args": ["-y", "job-application-tracker-mcp"],
      "env": { "JOB_TRACKER_FILE": "C:\\Users\\you\\Documents\\applications.json" }
    }
  }
}
```

## Privacy

The server makes no network calls and has no API keys, passwords or accounts. It reads and writes the one JSON file above and nothing else. There is no telemetry. What you tell the assistant in a chat is handled by the app you use, not by this server.

## FAQ

**Does it send reminders on its own?** No. MCP servers answer when asked. `list_upcoming` gives you the reminders when you ask, so a good habit is to start the week with "what is coming up?".

**Which applications show up in `list_upcoming`?** Deadlines of applications in the applied stage, and interview dates of applications in the interview stage. Offers and rejected applications are left out.

**Can I use it on two computers?** Point `JOB_TRACKER_FILE` at a file in a folder you already sync, and both computers read the same list. Do not use both at the same moment.

## Troubleshooting

If `npx -y job-application-tracker-mcp` fails or hangs:

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

## License

MIT
