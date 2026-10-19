# news-navigation-crawler

A JavaScript/Node.js project that uses Playwright to crawl a news portal's
navigation menu and export the hierarchy to CSV.

Status: the current prototype (prototype.js) extracts navigation rows from a
local HTML fixture only. It has NOT been validated against a live website.

The CSV schema is dynamic: after "Channel", one category column is emitted per
navigation depth discovered ("Category", "Subcategory", "Sub-Subcategory",
then "Category-4", "Category-5", ...), with "Link" always last.

Commands: run the fixture prototype with "node prototype.js" (writes
output/navigation.csv); run the tests with "npm test".
