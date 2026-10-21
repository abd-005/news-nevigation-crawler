"use strict";

const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const { extractNavigation } = require("./lib/extract-navigation");
const { buildCsv } = require("./lib/csv");

const CHANNEL = "BBC";
const NAV_SELECTOR = 'nav[aria-label="Primary"]';
const VALID_PROTOCOLS = new Set(["http:", "https:"]);

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

// Validates a user-supplied crawl target URL. Only well-formed
// http(s) URLs are accepted; anything else is rejected with a clear
// message. This is a validation-only foundation: no request is made.
function parseUrlInput(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: `Malformed URL: ${input}` };
  }
  if (!VALID_PROTOCOLS.has(url.protocol)) {
    return {
      ok: false,
      error:
        `Unsupported protocol "${url.protocol}" in URL: ${input}. ` +
        "Only http: and https: are allowed.",
    };
  }
  return { ok: true, url: url.href };
}

// Minimal CLI argument parser. Supported:
//   (no arguments)          run the local HTML fixture workflow
//   --url <URL>             validate a target URL (no request is made)
function parseArgs(argv) {
  const args = { url: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url") {
      const value = argv[i + 1];
      if (value === undefined) {
        return { ok: false, error: "--url requires a value." };
      }
      args.url = value;
      i += 1;
    } else {
      return { ok: false, error: `Unknown argument: ${arg}` };
    }
  }
  return { ok: true, args };
}

async function main(argv = process.argv.slice(2)) {
  const parsedArgs = parseArgs(argv);
  if (!parsedArgs.ok) {
    console.error(parsedArgs.error);
    console.error(
      "Usage: node prototype.js               run the local HTML fixture"
    );
    console.error(
      "       node prototype.js --url <URL>   validate a target URL (no request is made)"
    );
    process.exitCode = 1;
    return;
  }

  if (parsedArgs.args.url !== null) {
    const parsedUrl = parseUrlInput(parsedArgs.args.url);
    if (!parsedUrl.ok) {
      console.error(parsedUrl.error);
      process.exitCode = 1;
      return;
    }
    console.log(`URL accepted: ${parsedUrl.url}`);
    console.log(
      "Live crawling is not implemented yet; no request was made."
    );
    return;
  }

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

module.exports = {
  CHANNEL,
  NAV_SELECTOR,
  fixture,
  crawlHtml,
  parseArgs,
  parseUrlInput,
  main,
};
