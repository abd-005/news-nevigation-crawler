"use strict";

const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const { extractNavigation } = require("./lib/extract-navigation");
const { buildCsv } = require("./lib/csv");

const CHANNEL = "BBC";
const NAV_SELECTOR = 'nav[aria-label="Primary"]';

const fixture = `
<!doctype html>
<html>
<body>
  <nav aria-label="Primary">
    <ul>
      <li>
        <a href="https://www.bbc.com/news">News</a>
        <ul>
          <li>
            <a href="https://www.bbc.com/news/world">World</a>
            <ul>
              <li>
                <a href="https://www.bbc.com/news/world/africa">
                  Africa
                </a>
              </li>
            </ul>
          </li>
          <li>
            <a href="https://www.bbc.com/news/uk">UK</a>
          </li>
        </ul>
      </li>
      <li>
        <a href="https://www.bbc.com/sport">Sport</a>
      </li>
    </ul>
  </nav>
  <footer>
    <a href="https://example.com/privacy">Privacy</a>
  </footer>
</body>
</html>
`;

async function crawlHtml(browser, html, navSelector = NAV_SELECTOR) {
  const page = await browser.newPage();
  try {
    await page.setContent(html);
    return await page.evaluate(extractNavigation, navSelector);
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const rows = await crawlHtml(browser, fixture);
    const csv = buildCsv(rows, CHANNEL);

    const outputDir = path.join(__dirname, "output");
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(
      path.join(outputDir, "navigation.csv"),
      csv,
      "utf8"
    );

    console.log(`CSV rows exported: ${rows.length}`);
    console.log("Output: output/navigation.csv");
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { CHANNEL, NAV_SELECTOR, fixture, crawlHtml, main };
