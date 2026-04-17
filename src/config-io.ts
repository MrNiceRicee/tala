// File-IO helpers that deliberately stay out of src/config.ts.
//
// src/config.ts imports from "effect" for Schema, which activates linteffect
// rules (no try/catch, no ternaries, etc.). Synchronous JSON reads are best
// expressed with try/catch, so this module holds those. It imports no Effect
// symbols, keeping linteffect off its back.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export function safeReadJson(path: string): unknown {
	if (!existsSync(path)) return undefined;
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		// Malformed JSON: fail-open so a broken config never blocks the CLI.
		return undefined;
	}
}

export function resolveRelativePath(
	labRoot: string,
	relativePath: string,
): string {
	return isAbsolute(relativePath) ? relativePath : join(labRoot, relativePath);
}
