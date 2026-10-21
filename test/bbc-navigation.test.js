"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const { extractNavigation } = require("../lib/extract-navigation");
const { extractNoscriptTree } = require("../lib/extract-noscript-tree");
const { buildCsv } = require("../lib/csv");

let browser;

test.before(async () => {
  browser = await chromium.launch({ headless: true });
});

test.after(async () => {
  await browser.close();
});

// Loads a local HTML string into a local page. No network access.
async function rowsFor(html, extractor, selector) {
  const page = await browser.newPage();
  try {
    await page.setContent(html);
    return await page.evaluate(extractor, selector);
  } finally {
    await page.close();
  }
}

function csvLines(csv) {
  return csv.slice(1).split("\r\n");
}

// BBC-style menu: submenu ULs are SIBLINGS of their parent LI, every LI
// is followed by exactly one sublist (possibly empty), and anchors are
// wrapped in a div. Mirrors the structure observed in BBC's no-JS
// fallback menu, trimmed to the cases under test. The container is a
// plain nav so the fixture stays parseable with scripting enabled
// (noscript content becomes raw text in that mode); how the real BBC
// noscript tree is surfaced to the extractor is a source-selection
// concern, not an extraction concern.
const BBC_FIXTURE = `
<!doctype html>
<html>
<body>
  <nav id="main-navigation-container">
    <section>
      <ul>
        <li><div><a href="https://www.bbc.com/">Home</a></div></li>
        <ul></ul>
        <li><div><a href="https://www.bbc.com/news">News</a></div></li>
        <ul>
          <li><div><a href="https://www.bbc.com/news/uk">UK</a></div></li>
          <ul>
            <li><div><a href="https://www.bbc.com/news/uk/england">England</a></div></li>
            <ul></ul>
            <li><div><a href="https://www.bbc.com/news/uk/northern_ireland">N. Ireland</a></div></li>
            <ul>
              <li><div><a href="https://www.bbc.com/news/uk/northern_ireland/northern_ireland_politics">N. Ireland Politics</a></div></li>
              <ul></ul>
            </ul>
          </ul>
          <li><div><a href="https://www.bbc.com/news/world/africa">Africa</a></div></li>
          <ul></ul>
          <li><div><a href="https://www.bbc.com/live">Live</a></div></li>
          <ul></ul>
        </ul>
        <li><div><a href="https://www.bbc.com/sport">Sport</a></div></li>
        <ul>
          <li><div><a href="https://www.bbc.com/live">Live</a></div></li>
          <ul></ul>
        </ul>
      </ul>
    </section>
  </nav>
  <footer>
    <nav aria-label="Footer navigation">
      <ul>
        <li><a href="https://www.bbc.com/pages/terms">Terms of Use</a></li>
      </ul>
    </nav>
    <a href="https://www.bbc.com/privacy">Privacy</a>
  </footer>
  <article>
    <a href="https://www.bbc.com/news/story-123">Story body link</a>
  </article>
</body>
</html>
`;

test("BBC-style sibling sublists yield the full hierarchy in document order", async () => {
  const rows = await rowsFor(
    BBC_FIXTURE,
    extractNoscriptTree,
    "#main-navigation-container"
  );
  assert.deepEqual(
    rows.map((row) => row.hierarchy),
    [
      ["Home"],
      ["News"],
      ["News", "UK"],
      ["News", "UK", "England"],
      ["News", "UK", "N. Ireland"],
      ["News", "UK", "N. Ireland", "N. Ireland Politics"],
      ["News", "Africa"],
      ["News", "Live"],
      ["Sport"],
      ["Sport", "Live"],
    ]
  );
});

test("empty leaf lists produce no rows", async () => {
  const rows = await rowsFor(
    BBC_FIXTURE,
    extractNoscriptTree,
    "#main-navigation-container"
  );
  // Every LI is followed by a sublist, several of them empty. If empty
  // lists leaked rows, the count would exceed the 10 hierarchy entries.
  assert.equal(rows.length, 10);
});

test("missing labels are not synthesized from URLs", async () => {
  const rows = await rowsFor(
    BBC_FIXTURE,
    extractNoscriptTree,
    "#main-navigation-container"
  );
  const africa = rows.find(
    (row) => row.href === "https://www.bbc.com/news/world/africa"
  );
  // The URL implies News > World > Africa, but the menu has no "World"
  // item, so the hierarchy must stay menu-derived.
  assert.deepEqual(africa.hierarchy, ["News", "Africa"]);
});

test("a repeated URL in different contexts stays as separate rows", async () => {
  const rows = await rowsFor(
    BBC_FIXTURE,
    extractNoscriptTree,
    "#main-navigation-container"
  );
  const liveRows = rows.filter(
    (row) => row.href === "https://www.bbc.com/live"
  );
  assert.deepEqual(
    liveRows.map((row) => row.hierarchy),
    [
      ["News", "Live"],
      ["Sport", "Live"],
    ]
  );
});

test("footer and article links are excluded", async () => {
  const rows = await rowsFor(
    BBC_FIXTURE,
    extractNoscriptTree,
    "#main-navigation-container"
  );
  const hrefs = rows.map((row) => row.href).join(" ");
  assert.ok(!hrefs.includes("terms"));
  assert.ok(!hrefs.includes("privacy"));
  assert.ok(!hrefs.includes("story-123"));
});

test("a missing navigation container yields no rows", async () => {
  const rows = await rowsFor(
    BBC_FIXTURE,
    extractNoscriptTree,
    "#does-not-exist"
  );
  assert.deepEqual(rows, []);
});

test("BBC-style rows produce mixed-depth CSV output with stable formatting", async () => {
  const rows = await rowsFor(
    BBC_FIXTURE,
    extractNoscriptTree,
    "#main-navigation-container"
  );
  const csv = buildCsv(rows, "BBC");
  const lines = csvLines(csv);
  assert.equal(
    lines[0],
    '"Channel","Category","Subcategory","Sub-Subcategory","Category-4","Link"'
  );
  assert.equal(
    lines[1],
    '"BBC","Home","","","","https://www.bbc.com/"'
  );
  assert.equal(
    lines[6],
    '"BBC","News","UK","N. Ireland","N. Ireland Politics","https://www.bbc.com/news/uk/northern_ireland/northern_ireland_politics"'
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.doesNotMatch(csv, /(^|[^\r])\n/);
});

// Generic-structure fixtures for the generalized extractNavigation.

test("wrapped anchors below a nested root-list wrapper are extracted", async () => {
  const rows = await rowsFor(
    `
    <nav aria-label="Primary">
      <section>
        <nav>
          <ul>
            <li><div><a href="https://example.org/news">News</a></div>
              <ul>
                <li><div><a href="https://example.org/news/world">World</a></div></li>
              </ul>
            </li></ul>
          </nav>
        </nav>
      </section>
    </nav>
    `,
    extractNavigation,
    'nav[aria-label="Primary"]'
  );
  assert.deepEqual(rows, [
    { hierarchy: ["News"], href: "https://example.org/news" },
    { hierarchy: ["News", "World"], href: "https://example.org/news/world" },
  ]);
});

test("an item without its own link is skipped with its submenu", async () => {
  const rows = await rowsFor(
    `
    <nav aria-label="Primary"><ul>
      <li>
        <ul><li><a href="https://example.org/orphan">Orphan</a></li></ul>
      </li>
      <li><a href="https://example.org/sport">Sport</a></li>
    </ul></nav>
    `,
    extractNavigation,
    'nav[aria-label="Primary"]'
  );
  assert.deepEqual(rows, [
    { hierarchy: ["Sport"], href: "https://example.org/sport" },
  ]);
});

test("a linkless separator keeps a sibling submenu with its preceding item", async () => {
  const rows = await rowsFor(
    `
    <nav id="main-navigation-container"><ul>
      <li><div><a href="https://example.org/news">News</a></div></li>
      <li class="separator" aria-hidden="true"><span>|</span></li>
      <ul>
        <li><div><a href="https://example.org/news/uk">UK</a></div></li>
        <ul></ul>
      </ul>
      <li><div><a href="https://example.org/sport">Sport</a></div></li>
      <ul></ul>
    </ul></nav>
    `,
    extractNoscriptTree,
    "#main-navigation-container"
  );
  assert.deepEqual(
    rows.map((row) => row.hierarchy),
    [["News"], ["News", "UK"], ["Sport"]]
  );
});
