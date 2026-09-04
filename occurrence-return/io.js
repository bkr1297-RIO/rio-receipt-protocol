const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonDurable(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const descriptor = fs.openSync(filePath, "w", 0o600);
  try {
    fs.writeFileSync(descriptor, JSON.stringify(value, null, 2) + "\n", "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  return filePath;
}

function appendJsonLineDurable(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const descriptor = fs.openSync(filePath, "a", 0o600);
  try {
    const line = Buffer.from(JSON.stringify(value) + "\n", "utf8");
    let offset = 0;
    while (offset < line.length) {
      const written = fs.writeSync(
        descriptor,
        line,
        offset,
        line.length - offset
      );
      if (written === 0) throw new Error("journal write made no progress");
      offset += written;
    }
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  return filePath;
}

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

module.exports = { appendJsonLineDurable, readJson, readJsonLines, writeJsonDurable };
