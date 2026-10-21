"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const { extractNavigation } = require("../lib/extract-navigation");
const { buildCsv } = require("../lib/csv");
const { NAV_SELECTOR, fixture } = require("../prototype");

let browser;

test.before(async () => {
  browser = await chromium.launch({ headless: true });
});

test.after(async () => {
  await browser.close();
});

// Loads a local HTML string into a local page. No network access.
async function rowsFor(html, selector = NAV_SELECTOR) {
  const page = await browser.newPage();
  try {
    await page.setContent(html);
    return await page.evaluate(extractNavigation, selector);
  } finally {
    await page.close();
  }
}

function csvLines(csv) {
  return csv.slice(1).split("\r\n");
}

test("shallow navigation yields a single category level", async () => {
  const rows = await rowsFor(`
    <nav aria-label="Primary"><ul>
      <li><a href="https://example.org/news">News</a></li>
    </ul></nav>
  `);
  assert.deepEqual(rows, [
    { hierarchy: ["News"], href: "https://example.org/news" },
  ]);
});

test("deep navigation grows the hierarchy with each submenu level", async () => {
  const rows = await rowsFor(`
    <nav aria-label="Primary"><ul>
      <li><a href="https://example.org/news">News</a>
        <ul><li><a href="https://example.org/world">World</a>
          <ul><li><a href="https://example.org/europe">Europe</a>
            <ul><li><a href="https://example.org/balkans">Balkans</a></li></ul>
          </li></ul>
        </ul></li>
      </li>
    </ul></nav>
  `);
  assert.deepEqual(
    rows.map((row) => row.hierarchy),
    [
      ["News"],
      ["News", "World"],
      ["News", "World", "Europe"],
      ["News", "World", "Europe", "Balkans"],
    ]
  );

  const lines = csvLines(buildCsv(rows, "BBC"));
  assert.equal(
    lines[0],
    '"Channel","Category","Subcategory","Sub-Subcategory","Category-4","Link"'
  );
  assert.equal(
    lines[4],
    '"BBC","News","World","Europe","Balkans","https://example.org/balkans"'
  );
});

test("a repeated URL in different contexts stays as separate rows", async () => {
  const rows = await rowsFor(`
    <nav aria-label="Primary"><ul>
      <li><a href="https://example.org/">News</a>
        <ul><li><a href="https://example.org/live">Live</a></li></ul>
      </li>
      <li><a href="https://example.org/sport">Sport</a>
        <ul><li><a href="https://example.org/live">Live</a></li></ul>
      </li>
    </ul></nav>
  `);
  const liveRows = rows.filter(
    (row) => row.href === "https://example.org/live"
  );
  assert.equal(liveRows.length, 2);
  assert.deepEqual(
    liveRows.map((row) => row.hierarchy),
    [
      ["News", "Live"],
      ["Sport", "Live"],
    ]
  );
});

test("links outside the primary navigation are excluded", async () => {
  const rows = await rowsFor(`
    <nav aria-label="Primary"><ul>
      <li><a href="https://example.org/news">News</a></li>
    </ul></nav>
    <footer><a href="https://example.org/privacy">Privacy</a></footer>
    <a href="https://example.org/signin">Sign in</a>
    <article><a href="https://example.org/story">Story body</a></article>
  `);
  assert.deepEqual(
    rows.map((row) => row.href),
    ["https://example.org/news"]
  );
});

test("a missing navigation container yields no rows", async () => {
  const rows = await rowsFor(
    "<main><p>No navigation here</p></main>",
    'nav[aria-label="Missing"]'
  );
  assert.deepEqual(rows, []);
});

test("labels containing double quotes are escaped in the CSV", async () => {
  const rows = await rowsFor(`
    <nav aria-label="Primary"><ul>
      <li><a href="https://example.org/hub">Sports "Live" Hub</a></li>
    </ul></nav>
  `);
  assert.ok(
    buildCsv(rows, "BBC").includes(
      '"BBC","Sports ""Live"" Hub","https://example.org/hub"'
    )
  );
});

test("the original prototype fixture produces the expected five rows", async () => {
  const rows = await rowsFor(fixture);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[2], {
    hierarchy: ["News", "World", "Africa"],
    href: "https://www.bbc.com/news/world/africa",
  });
  assert.deepEqual(rows[3], {
    hierarchy: ["News", "UK"],
    href: "https://www.bbc.com/news/uk",
  });

  const csv = buildCsv(rows, "BBC");
  const lines = csvLines(csv);
  assert.equal(
    lines[0],
    '"Channel","Category","Subcategory","Sub-Subcategory","Link"'
  );
  assert.equal(
    lines[3],
    '"BBC","News","World","Africa","https://www.bbc.com/news/world/africa"'
  );
  assert.ok(!csv.includes("privacy"), "footer link must not appear");
});

test("a labeled anchor is preferred over an earlier empty icon anchor", async () => {
  const rows = await rowsFor(`
    <nav aria-label="Primary"><ul>
      <li>
        <a href="https://example.org/news" aria-hidden="true">
          <span class="icon"></span>
        </a>
        <a href="https://example.org/news">News</a>
      </li>
    </ul></nav>
  `);
  assert.deepEqual(rows, [
    { hierarchy: ["News"], href: "https://example.org/news" },
  ]);
});

test("items with empty or whitespace-only labels produce no rows", async () => {
  const rows = await rowsFor(`
    <nav aria-label="Primary"><ul>
      <li><a href="https://example.org/empty"></a></li>
      <li><a href="https://example.org/blank">   \n\t  </a></li>
      <li><a href="https://example.org/news">News</a></li>
    </ul></nav>
  `);
  assert.deepEqual(rows, [
    { hierarchy: ["News"], href: "https://example.org/news" },
  ]);
});

test("structural wrappers around list items preserve hierarchy and order", async () => {
  const rows = await rowsFor(`
    <nav aria-label="Primary"><ul>
      <div class="column">
        <li><a href="https://example.org/news">News</a>
          <div class="submenu-wrapper">
            <ul>
              <div class="submenu-column">
                <li><a href="https://example.org/news/world">World</a></li>
                <li><a href="https://example.org/news/uk">UK</a></li>
              </div>
            </ul>
          </div>
        </li>
        <li><a href="https://example.org/sport">Sport</a></li>
      </div>
    </ul></nav>
  `);
  assert.deepEqual(
    rows.map((row) => row.hierarchy),
    [["News"], ["News", "World"], ["News", "UK"], ["Sport"]]
  );
});
