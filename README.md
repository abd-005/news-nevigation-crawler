# news-navigation-crawler

A JavaScript/Node.js project that uses Playwright to crawl a news portal's
navigation menu and export the hierarchy to CSV.

Status: fixture-based extraction only. The crawler has NOT been validated
against a live website, and live crawling is not implemented yet. Automated
tests exist under `test/` and pass with `npm test`.

Extraction:
- `lib/extract-navigation.js`: generic menu walker. Handles anchors wrapped
  in non-list elements (`li > div > a`), structural wrappers (`div`,
  `section`, `span`) between a list and its items, and a root list nested
  below wrapper elements (`nav > section > nav > ul`). Within an item, the
  first anchor with a non-empty label is used, so an earlier decorative or
  whitespace-only anchor does not produce an empty-label row. Items with no
  labeled anchor are skipped. Submenus are the item's first descendant `UL`.
- `lib/extract-noscript-tree.js`: walker for BBC-style menus whose submenu
  `UL` elements are SIBLINGS of the parent `LI` (the structure used by
  BBC's no-JS fallback menu, including empty leaf lists). Linkless separator
  items do not take ownership of a following sibling sublist. Hierarchy
  depth is derived from list nesting, never from generated CSS class names.
- Only `UL` is supported as a submenu type in both extractors. An `OL`
  submenu is not traversed and does not add hierarchy rows.

The CSV schema is dynamic: after "Channel", one category column is emitted per
navigation depth discovered ("Category", "Subcategory", "Sub-Subcategory",
then "Category-4", "Category-5", ...), with "Link" always last.

Commands:
- `node prototype.js` - run the fixture prototype (writes
  `output/navigation.csv`).
- `node prototype.js --url <URL>` - validate a target URL (http/https only).
  Validation only: no request is made and live crawling is not implemented.
- `npm test` - run the automated tests (local fixtures only, no network).
