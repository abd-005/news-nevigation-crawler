
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const CHANNEL = "BBC";

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

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(fixture);

    const rows = await page.locator(
      'nav[aria-label="Primary"]'
    ).evaluate((nav) => {
      const results = [];

      function visit(list, parents = []) {
        for (const item of list.children) {
          if (item.tagName !== "LI") continue;

          const link = Array.from(item.children).find(
            (child) => child.tagName === "A"
          );

          if (!link) continue;

          const label = link.textContent.trim();
          const hierarchy = [...parents, label];

          results.push({
            category: hierarchy[0] || "",
            subcategory: hierarchy[1] || "",
            subSubcategory: hierarchy[2] || "",
            link: link.href,
          });

          const submenu = Array.from(item.children).find(
            (child) => child.tagName === "UL"
          );

          if (submenu) visit(submenu, hierarchy);
        }
      }

      const rootList = Array.from(nav.children).find(
        (child) => child.tagName === "UL"
      );

      if (rootList) visit(rootList);

      return results;
    });

    const columns = [
      "Channel",
      "Category",
      "Subcategory",
      "Sub-Subcategory",
      "Link",
    ];

    function escapeCsv(value) {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    }

    const csv = [
      columns.map(escapeCsv).join(","),
      ...rows.map((row) =>
        [
          CHANNEL,
          row.category,
          row.subcategory,
          row.subSubcategory,
          row.link,
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ].join("\r\n");

    const outputDir = path.join(__dirname, "output");
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(
      path.join(outputDir, "navigation.csv"),
      "\uFEFF" + csv,
      "utf8"
    );

    console.log(`CSV rows exported: ${rows.length}`);
    console.log("Output: output/navigation.csv");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
