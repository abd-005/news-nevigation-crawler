"use strict";

// Runs inside the browser page, passed to Playwright's page.evaluate().
// Extracts a hierarchical navigation menu whose submenu UL elements are
// SIBLINGS of their parent LI (the structure used by BBC's no-JS
// fallback menu):
//
//   <ul>                       <- root list
//     <li><a ...>News</a></li>
//     <ul>                     <- submenu of the PRECEDING "News" li
//       <li><a ...>UK</a></li>
//       <ul></ul>              <- empty leaf list, produces no rows
//     </ul>
//   </ul>
//
// Depth is derived from list nesting only, never from generated CSS
// class names. An item's link may be direct or wrapped in non-list
// elements (li > div > a). Decorative or whitespace-only anchors are
// skipped when a labeled anchor exists, and items with no labeled
// anchor produce no row. Returns one entry per link, in document
// order, with the same shape as extractNavigation:
//   { hierarchy: ["News", "UK"], href: "https://..." }
// Repeated URLs in different navigation contexts stay as separate rows.
// Only links inside the given navigation container are returned.
// Only UL is supported as a submenu type; OL is not traversed.

function extractNoscriptTree(navSelector) {
  const nav = document.querySelector(navSelector);
  if (!nav) return [];

  const rootList = nav.querySelector("ul");
  if (!rootList) return [];

  const results = [];

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

  function visitList(list, parents) {
    // Hierarchy of the most recent LI without a consumed sublist yet.
    let pendingItemHierarchy = null;

    for (const child of list.children) {
      if (child.tagName === "LI") {
        const link = findItemLink(child);
        // A linkless item (for example a separator) produces no row and
        // does not consume the pending sublist owner. A sibling UL after
        // the separator still belongs to the preceding labeled item.
        if (!link) continue;

        const hierarchy = [...parents, link.textContent.trim()];
        results.push({ hierarchy, href: link.href });
        pendingItemHierarchy = hierarchy;

        // Some menus also nest a submenu inside the LI; support both
        // shapes without double-counting. The first descendant UL is
        // the item's own submenu (wrapper elements tolerated).
        const ownSubmenu = child.querySelector("ul");
        if (ownSubmenu) visitList(ownSubmenu, hierarchy);
      } else if (child.tagName === "UL") {
        // A sibling sublist belongs to the preceding LI. Consume the
        // pending item so a second stray list cannot attach to it.
        if (pendingItemHierarchy) {
          visitList(child, pendingItemHierarchy);
          pendingItemHierarchy = null;
        }
      }
    }
  }

  visitList(rootList, []);

  return results;
}

module.exports = { extractNoscriptTree };
