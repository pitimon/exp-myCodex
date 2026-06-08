#!/usr/bin/env node
"use strict";

const chunks = [];

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
