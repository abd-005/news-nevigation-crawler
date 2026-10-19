"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { escapeCsvField, categoryHeader, buildCsv } = require("../lib/csv");

// Splits CSV lines on cell boundaries. Safe for these fixtures because
// every field is quoted and none of the labels contains the sequence ","".
function csvLines(csv) {
  return csv.slice(1).split("\r\n");
}

function widths(csv) {
  return csvLines(csv).map((line) => line.split('","').length);
}

test("escapeCsvField wraps every field in quotes and doubles embedded quotes", () => {
  assert.equal(escapeCsvField("News"), '"News"');
  assert.equal(escapeCsvField('Sports "Live"'), '"Sports ""Live"""');
  assert.equal(escapeCsvField("a,b"), '"a,b"');
  assert.equal(escapeCsvField(null), '""');
  assert.equal(escapeCsvField(undefined), '""');
});

test("categoryHeader names depths 1 to 3 and generically names deeper levels", () => {
  assert.equal(categoryHeader(1), "Category");
  assert.equal(categoryHeader(2), "Subcategory");
  assert.equal(categoryHeader(3), "Sub-Subcategory");
  assert.equal(categoryHeader(4), "Category-4");
  assert.equal(categoryHeader(5), "Category-5");
});

test("buildCsv sizes category columns to the deepest hierarchy", () => {
  const rows = [
    { hierarchy: ["News", "World", "Africa"], href: "https://example.org/a" },
    { hierarchy: ["Sport"], href: "https://example.org/b" },
  ];
  assert.equal(
    buildCsv(rows, "BBC"),
    '\uFEFF"Channel","Category","Subcategory","Sub-Subcategory","Link"\r\n' +
      '"BBC","News","World","Africa","https://example.org/a"\r\n' +
      '"BBC","Sport","","","https://example.org/b"'
  );
});

test("buildCsv keeps every row the same width and pads shallow rows", () => {
  const rows = [
    {
      hierarchy: ["News", "World", "Europe", "Balkans"],
      href: "https://example.org/deep",
    },
    { hierarchy: ["Sport"], href: "https://example.org/shallow" },
  ];
  const lines = csvLines(buildCsv(rows, "BBC"));
  assert.equal(lines.length, 3);
  assert.deepEqual(widths(buildCsv(rows, "BBC")), [6, 6, 6]);
  assert.equal(
    lines[2],
    '"BBC","Sport","","","","https://example.org/shallow"'
  );
});

test("buildCsv keeps the same URL as separate rows for distinct contexts", () => {
  const rows = [
    { hierarchy: ["News", "Live"], href: "https://example.org/live" },
    { hierarchy: ["Sport", "Live"], href: "https://example.org/live" },
  ];
  const lines = csvLines(buildCsv(rows, "BBC"));
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes('"News","Live","https://example.org/live"'));
  assert.ok(lines[2].includes('"Sport","Live","https://example.org/live"'));
});

test("buildCsv uses a UTF-8 BOM and CRLF line endings only", () => {
  const rows = [
    { hierarchy: ["News"], href: "https://example.org/n" },
    { hierarchy: ["News", "World"], href: "https://example.org/w" },
  ];
  const csv = buildCsv(rows, "BBC");
  assert.ok(csv.startsWith("\uFEFF"));
  assert.doesNotMatch(csv, /(^|[^\r])\n/);
});

test("buildCsv with no rows emits only the Channel and Link columns", () => {
  assert.equal(buildCsv([], "BBC"), '\uFEFF"Channel","Link"');
});
