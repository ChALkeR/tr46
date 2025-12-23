"use strict";

const fs = require("fs");
const path = require("path");
const { unicodeVersion } = require("../package.json");
const { STATUS_MAPPING } = require("../lib/statusMapping.js");

main().catch(e => {
  console.error(e);
  process.exit(1);
});

async function main() {
  const response = await fetch(`https://unicode.org/Public/${unicodeVersion}/idna/IdnaMappingTable.txt`);
  if (!response.ok) {
    throw new Error(`Failed to fetch IdnaMappingTable.txt: ${response.status}`);
  }
  const body = await response.text();

  const ranges = [];
  const lines = [];

  body.split("\n").forEach(l => {
    l = l.split("#")[0]; // Remove comments
    const cells = l.split(";").map(c => {
      return c.trim();
    });
    if (cells.length === 1) {
      return;
    }

    // Parse ranges to int[2] array
    const range = cells[0].split("..");
    const start = parseInt(range[0], 16);
    const end = parseInt(range[1] || range[0], 16);
    cells[0] = [start, end - start];
    ranges.push(cells.shift());

    cells[0] = STATUS_MAPPING[cells[0]];
    if (cells[0] !== STATUS_MAPPING.mapped && cells[0] !== STATUS_MAPPING.deviation) {
      lines.push(cells[0]);
      return;
    }

    if (cells[1] !== undefined) {
      // Parse replacement to int[] array
      let replacement = cells[1].split(" ");
      if (replacement[0] === "") { // Empty array
        replacement = [];
      }

      replacement = replacement.map(r => {
        return parseInt(r, 16);
      });

      cells[1] = String.fromCodePoint(...replacement);
    } else {
      throw new Error("Unexpected");
    }

    lines.push(cells.flat());
  });

  // We could drop valid chars, but those are only ~1000 ranges and
  // binary search is way to quick to even notice that

  // Delta-code starts
  let last = 0;
  for (const range of ranges) {
    range[0] -= last;
    last += range[0];
  }

  fs.writeFileSync(path.resolve(__dirname, "../lib/mappingTable.json"), JSON.stringify([ranges.flat(), lines.flat()]));
}
