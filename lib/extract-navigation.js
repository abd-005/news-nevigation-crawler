"use strict";

// Runs inside the browser page, passed to Playwright's page.evaluate().
// Returns one entry per navigation link, in document order:
//   { hierarchy: ["News", "World"], href: "https://..." }
// hierarchy holds the label path from the top-level menu item down to the
// link itself. Every DOM node produces its own entry, so the same URL
// appearing in different navigation contexts stays as separate rows.
// Only links inside the given navigation container are returned, so
// footer, article-body, account, and utility links never appear.

function extractNavigation(navSelector) {
  const nav = document.querySelector(navSelector);
  if (!nav) return [];

  const results = [];

  function visit(list, parents) {
    for (const item of list.children) {
      if (item.tagName !== "LI") continue;

      const link = Array.from(item.children).find(
        (child) => child.tagName === "A"
      );
      if (!link) continue;

      const hierarchy = [...parents, link.textContent.trim()];
      results.push({ hierarchy, href: link.href });

      const submenu = Array.from(item.children).find(
        (child) => child.tagName === "UL"
      );
      if (submenu) visit(submenu, hierarchy);
    }
  }

  const rootList = Array.from(nav.children).find(
    (child) => child.tagName === "UL"
  );
  if (rootList) visit(rootList, []);

  return results;
}

module.exports = { extractNavigation };
