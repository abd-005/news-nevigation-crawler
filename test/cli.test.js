"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const { parseArgs, parseUrlInput } = require("../prototype");

const PROTOTYPE = path.join(__dirname, "..", "prototype.js");

test("parseUrlInput accepts a well-formed https URL", () => {
  const result = parseUrlInput("https://www.bbc.com/news");
  assert.equal(result.ok, true);
  assert.equal(result.url, "https://www.bbc.com/news");
});

test("parseUrlInput accepts a well-formed http URL", () => {
  const result = parseUrlInput("http://example.org/");
  assert.equal(result.ok, true);
  assert.equal(result.url, "http://example.org/");
});

test("parseUrlInput rejects a malformed URL", () => {
  for (const input of ["", "not a url", "https://", "www.bbc.com/news"]) {
    const result = parseUrlInput(input);
    assert.equal(result.ok, false, `expected rejection for: ${input}`);
    assert.match(result.error, /Malformed URL/);
  }
});

test("parseUrlInput rejects non-HTTP(S) protocols", () => {
  for (const input of [
    "file:///etc/passwd",
    "ftp://example.org/file",
    "javascript:alert(1)",
    "data:text/html,hello",
  ]) {
    const result = parseUrlInput(input);
    assert.equal(result.ok, false, `expected rejection for: ${input}`);
    assert.match(result.error, /Unsupported protocol/);
  }
});

test("parseArgs handles no arguments and --url values", () => {
  assert.deepEqual(parseArgs([]), { ok: true, args: { url: null } });
  assert.deepEqual(parseArgs(["--url", "https://example.org/"]), {
    ok: true,
    args: { url: "https://example.org/" },
  });
});

test("parseArgs rejects a missing --url value and unknown arguments", () => {
  assert.equal(parseArgs(["--url"]).ok, false);
  const unknown = parseArgs(["--crawl"]);
  assert.equal(unknown.ok, false);
  assert.match(unknown.error, /Unknown argument/);
});

test("the CLI rejects a non-HTTP protocol with exit code 1", () => {
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [PROTOTYPE, "--url", "file:///etc/passwd"],
        { encoding: "utf8" }
      ),
    (error) => error.status === 1
  );
});

test("the CLI accepts a valid URL without launching a browser or network", () => {
  const stdout = execFileSync(
    process.execPath,
    [PROTOTYPE, "--url", "https://example.org/news"],
    { encoding: "utf8" }
  );
  assert.match(stdout, /URL accepted: https:\/\/example\.org\/news/);
  assert.match(stdout, /no request was made/);
});
