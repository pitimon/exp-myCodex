#!/usr/bin/env node
"use strict";

const chunks = [];
const event = (() => {
  const index = process.argv.indexOf("--event");
  return index >= 0 ? process.argv[index + 1] : "";
})();

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = chunks.join("");
  const lines = input.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        delete parsed.suppressOutput;
        if (
          (event === "context" || event === "session-init") &&
          parsed.hookSpecificOutput &&
          typeof parsed.hookSpecificOutput === "object" &&
          typeof parsed.hookSpecificOutput.additionalContext === "string"
        ) {
          delete parsed.systemMessage;
        }
        process.stdout.write(`${JSON.stringify(parsed)}\n`);
      } else {
        process.stdout.write(`${line}\n`);
      }
    } catch {
      process.stdout.write(`${line}\n`);
    }
  }
});

process.stdin.resume();
