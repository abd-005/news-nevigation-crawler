"use strict";

// Runs inside the browser page, passed to Playwright's page.evaluate().
// Returns one entry per navigation link, in document order:
//   { hierarchy: ["News", "World"], href: "https://..." }
// hierarchy holds the label path from the top-level menu item down to the
// link itself. Every DOM node produces its own entry, so the same URL
// appearing in different navigation contexts stays as separate rows.
// Only links inside the given navigation container are returned, so
// footer, article-body, account, and utility links never appear.
//
// Generic structure handling:
// - The root list may sit below wrapper elements (for example
//   nav > section > nav > ul); the first descendant UL is used.
// - An item's link may be wrapped in non-list elements (for example
//   li > div > a); the first descendant A that is not inside a nested
//   submenu and has a non-empty label is used. Decorative or
//   whitespace-only anchors are skipped when a labeled anchor exists,
//   and items with no labeled anchor produce no row.
// - LI elements may be grouped inside structural wrappers (div, section,
//   span) between the list and its items. Those wrappers are transparent
//   and do not add a hierarchy level.
// - Submenus are the first descendant UL of an item that is not part
//   of a deeper item (wrapper elements around the submenu are tolerated).
//   Only UL is supported as a submenu type; OL is not traversed.
//   Menus whose sublists are SIBLINGS of the parent LI (BBC-style
//   no-JS fallback menus) are handled by lib/extract-noscript-tree.js.

function extractNavigation(navSelector) {
  const nav = document.querySelector(navSelector);
  if (!nav) return [];

  const results = [];
  const WRAPPER_TAGS = new Set(["DIV", "SECTION", "SPAN"]);

  function findItemLink(item) {
    for (const child of item.children) {
      if (child.tagName === "UL" || child.tagName === "OL") continue;
      if (child.tagName === "A") {
        if (child.textContent.trim()) return child;
        continue;
      }
      const nested = findItemLink(child);
      if (nested) return nested;
    }
    return null;
  }

  // Collect the LI items of one list in document order. Structural
  // wrappers between the list and its items are traversed without
  // adding hierarchy levels; nested lists are left to their item.
  function collectItems(container, items = []) {
    for (const child of container.children) {
      if (child.tagName === "LI") {
        items.push(child);
      } else if (WRAPPER_TAGS.has(child.tagName)) {
        collectItems(child, items);
      }
    }
    return items;
  }

  function visit(list, parents) {
    for (const item of collectItems(list)) {
      const link = findItemLink(item);
      if (!link) continue;

      const hierarchy = [...parents, link.textContent.trim()];
      results.push({ hierarchy, href: link.href });

      // First descendant UL in document order is the item's own
      // submenu; wrapper elements around it are tolerated.
      const submenu = item.querySelector("ul");
      if (submenu) visit(submenu, hierarchy);
    }
  }

  const rootList = nav.querySelector("ul");
  if (rootList) visit(rootList, []);

  return results;
}

module.exports = { extractNavigation };
