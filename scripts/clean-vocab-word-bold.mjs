import fs from "node:fs";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error("Usage: node clean-vocab-word-bold.mjs <input-path> <output-path>");
}

const source = fs.readFileSync(inputPath, "utf8");
const wordCellPattern = /^(\s*\|\s*)\*\*([^|]*?)\*\*(\s*\|)(.*)$/;
const rowsBefore = source.split(/\r?\n/).filter(line => line.includes("|") && !/^\s*\|?\s*:?-{3,}/.test(line));
let removed = 0;

const cleaned = source.split(/\r?\n/).map(line => {
  const match = line.match(wordCellPattern);
  if (!match) return line;
  removed += 1;
  return `${match[1]}${match[2]}${match[3]}${match[4]}`;
}).join("\n");

const rowsAfter = cleaned.split(/\r?\n/).filter(line => line.includes("|") && !/^\s*\|?\s*:?-{3,}/.test(line));
if (rowsBefore.length !== rowsAfter.length) throw new Error("Row count changed during cleanup.");

for (let index = 0; index < rowsBefore.length; index += 1) {
  const before = rowsBefore[index].replace(wordCellPattern, "$1$2$3$4");
  if (before !== rowsAfter[index]) throw new Error(`Unexpected non-word-cell change on table row ${index + 1}.`);
}

if (/^\s*\|\s*\*\*[^|]*?\*\*\s*\|/m.test(cleaned)) {
  throw new Error("A bold word cell remains after cleanup.");
}

fs.writeFileSync(outputPath, cleaned, "utf8");
console.log(JSON.stringify({ boldWordCellsRemoved: removed, tableRowsPreserved: rowsAfter.length, outputPath }));
