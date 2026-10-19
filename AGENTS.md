# AGENTS.md

Instructions for AI coding sessions working on this repository.

## Project Purpose and Status

News Portal Navigation Crawler: a JavaScript/Node.js tool that uses Playwright to
open a news portal and export its navigation menu hierarchy to CSV.

Current status (verify with `git log` and file contents before assuming):
- `prototype.js` extracts navigation rows from a LOCAL HTML FIXTURE only. It has
  never been verified against a live website.
- The CSV schema in the prototype uses a FIXED three-level category hierarchy.
  The agreed final design uses DYNAMIC category columns (see below). Do not treat
  the prototype's fixed columns as the final schema.
- There are no automated tests yet.

## Tech Stack Conventions

- Runtime: Node.js (>= 20 required by Playwright 1.64.x; current environment is
  newer). Module system: CommonJS (`"type": "commonjs"`). Use `require()`.
- Browser automation: Playwright (`playwright` package, chromium). Launch
  headless unless debugging; always close the browser in a `finally` block.
- No other runtime dependencies without asking the user first.
- Keep files small and focused; prefer plain functions over classes unless state
  clearly warrants otherwise.

## CSV Output Schema

Columns, in exact order:
1. `Channel` - portal name (for example, `BBC`).
2. Zero or more dynamic category columns, sized to the DEEPEST navigation
   hierarchy discovered in that run: `Category`, `Subcategory`,
   `Sub-Subcategory`, and so on. There is no fixed depth limit.
3. `Link` - always the final column.

Rules:
- Every row must have the SAME total number of columns. Rows shallower than the
  deepest level use empty cells for missing levels.
- Quote all fields; escape embedded double quotes by doubling them (`""`).
- Write a UTF-8 BOM and CRLF line endings so Excel renders the file correctly.
- If a configurable safety limit for malformed or excessively deep navigation is
  added later, make it configurable; never hardcode a small depth cap.

## Navigation Hierarchy Rules

- Preserve the parent-child structure of the navigation menu as column values.
- The same URL appearing in DIFFERENT navigation contexts must produce SEPARATE
  rows, one per context. Do not deduplicate by URL.
- Only extract links from the site's primary navigation container. Exclude
  footer links, article body links, and other unrelated page content.
- Never bypass access restrictions, paywalls, login requirements, or anti-bot
  protections. If the site blocks automated access, stop and report it.

## Testing Protocol

- Develop and validate extraction logic against LOCAL HTML FIXTURES first.
- Live-site validation only as a later step, at most a handful of pages, only
  after the user approves it.
- Never fabricate test results. When reporting, state exactly which commands and
  tests were actually executed and their real output.
- Any claim of success must be backed by a command that was run in the session.

## Ethical Crawling

- Respect the site's terms of service and `robots.txt`.
- Keep request rates reasonable: wait between page loads, avoid parallel hammering,
  and cap the number of pages per run.
- Identify the crawler honestly in the user agent if customization is needed.
- No CAPTCHA solving, fingerprint spoofing, or IP rotation.

## Git Discipline

- Run `git status` and `git diff` (and `git diff --cached`) BEFORE staging or
  committing anything. The staging area and working tree have drifted before;
  verify what is actually staged.
- NEVER commit, push, or stage files without explicit user approval in the
  current session.
- Commit small, coherent changes with short English messages.
- `node_modules/` and `output/` are gitignored. Do not force-add them.

## Communication Rules

- All responses, explanations, summaries, technical reports, logs, and terminal output MUST be written in English.
- Use plain English ASCII characters and standard punctuation in terminal output and technical reports. Avoid Bengali characters, emojis, and decorative Unicode symbols.
- Never respond in Bengali or Banglish, even if the user communicates in Bengali or Banglish.
- Use concise, professional English with clear headings and actionable explanations.
- Distinguish verified facts from assumptions in every report. Include exact filenames and command output when useful.
- If a command fails, report the actual error and do not claim success.
- Do not fabricate command output, test results, or verification evidence.
