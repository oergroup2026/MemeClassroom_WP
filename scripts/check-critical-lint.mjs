#!/usr/bin/env node
/**
 * Blocking CI gate for the lint rules that catch real, user-visible crashes.
 *
 * The codebase carries a few hundred style-level lint errors (mostly unused
 * variables). Gating on all of them would fail every build and simply get
 * switched off, so this gates on the narrow set of rules that have actually
 * shipped crashes to production:
 *
 *   no-undef                    — referencing a variable that does not exist.
 *                                 Shipped three times: the badge popup shown to
 *                                 every new user, the Library AI modal's close
 *                                 button, and a Staffroom handler.
 *   react-hooks/rules-of-hooks  — hooks called conditionally. Shipped once: the
 *                                 Resources detail popup threw on open.
 *   no-dupe-keys                — a duplicate object key silently discards one
 *                                 of the two values.
 *
 * Add rules here as the codebase gets cleaner. To see everything, run
 * `npm run lint`.
 */
import { ESLint } from "eslint";

const BLOCKING_RULES = new Set([
  "no-undef",
  "react-hooks/rules-of-hooks",
  "no-dupe-keys",
]);

const eslint = new ESLint();
const results = await eslint.lintFiles(["."]);

const failures = [];
for (const result of results) {
  for (const message of result.messages) {
    if (BLOCKING_RULES.has(message.ruleId)) {
      failures.push({
        file: result.filePath.replace(`${process.cwd()}/`, ""),
        line: message.line,
        rule: message.ruleId,
        text: message.message.split("\n")[0],
      });
    }
  }
}

if (failures.length === 0) {
  console.log(`✓ No blocking lint errors (${[...BLOCKING_RULES].join(", ")}).`);
  process.exit(0);
}

console.error(`\n✖ ${failures.length} blocking lint error(s) — these cause runtime crashes:\n`);
for (const f of failures) {
  console.error(`  ${f.file}:${f.line}  [${f.rule}]  ${f.text}`);
}
console.error("\nFix these before merging. Run `npm run lint` to see all lint output.\n");
process.exit(1);
