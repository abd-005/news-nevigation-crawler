"use strict";

// CSV building for the navigation export.
// Columns are dynamic: "Channel", one category column per discovered
// navigation depth, then "Link" as the final column. Depths 1-3 keep the
// familiar names; deeper levels use "Category-N" so the schema stays
// predictable at any hierarchy depth. Rows shallower than the deepest
// level are padded with empty cells so every row has the same width.
// Output uses a UTF-8 BOM and CRLF line endings for Excel compatibility.

function escapeCsvField(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function categoryHeader(depth) {
  if (depth === 1) return "Category";
  if (depth === 2) return "Subcategory";
  if (depth === 3) return "Sub-Subcategory";
  return `Category-${depth}`;
}

function maxDepth(rows) {
  return rows.reduce((max, row) => Math.max(max, row.hierarchy.length), 0);
}

function buildCsv(rows, channel) {
  const depth = maxDepth(rows);
  const header = [
    "Channel",
    ...Array.from({ length: depth }, (_, i) => categoryHeader(i + 1)),
    "Link",
  ];

  const lines = [header.map(escapeCsvField).join(",")];

  for (const row of rows) {
    const padding = Array(depth - row.hierarchy.length).fill("");
    const cells = [channel, ...row.hierarchy, ...padding, row.href];
    lines.push(cells.map(escapeCsvField).join(","));
  }

  return "\uFEFF" + lines.join("\r\n");
}

module.exports = { escapeCsvField, categoryHeader, buildCsv };
