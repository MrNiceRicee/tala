// `tala env sync` and `tala env check`.
//
// sync  - scans registered tools, unions their `env[]` arrays, writes the
//         required keys to `<envFile>.example`. Preserves any existing
//         leading comments in the file.
// check - loads the same env key set, compares to the active env file
//         (honoring config.envFile precedence), reports missing / surplus.
//         Exits 1 if any required key is missing so CI can gate.
//
// Both commands load tools via the same side-effect import used by the
// tools resource. Tools without `env[]` metadata contribute nothing - the
// absence is silent, not an error.

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { envFilePath, toolPath, toolsRoot } from "../config";
import { getRegisteredTool } from "../tool-runner";

export interface EnvSyncResult {
	success: boolean;
	examplePath: string;
	keysWritten: readonly string[];
	added: readonly string[];
	removed: readonly string[];
}

export interface EnvCheckResult {
	success: boolean;
	envFile: string;
	required: readonly string[];
	missing: readonly string[];
	present: readonly string[];
	surplus: readonly string[];
}

const requireTool = createRequire(import.meta.url);

// -----------------------------------------------------------------------------
// Tool scanning
// -----------------------------------------------------------------------------

function listToolNames(labRoot: string): string[] {
	const dir = toolsRoot(labRoot);
	if (!existsSync(dir)) return [];
	const names: string[] = [];
	for (const file of readdirSync(dir)) {
		if (!file.endsWith(".ts")) continue;
		if (file.startsWith("_")) continue;
		names.push(file.replace(/\.ts$/, ""));
	}
	names.sort();
	return names;
}

function loadTool(labRoot: string, name: string): void {
	const path = toolPath(labRoot, name);
	if (!existsSync(path)) return;
	try {
		requireTool(path);
	} catch {
		// tool file that throws on import contributes no env metadata
	}
}

function collectRequiredEnv(labRoot: string): readonly string[] {
	const tools = listToolNames(labRoot);
	for (const tool of tools) loadTool(labRoot, tool);

	const keys = new Set<string>();
	for (const tool of tools) {
		const def = getRegisteredTool(tool);
		for (const key of def?.env ?? []) keys.add(key);
	}
	return [...keys].sort();
}

// -----------------------------------------------------------------------------
// .env file parsing
// -----------------------------------------------------------------------------

const LINE_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;

function parseEnvKeys(raw: string): Set<string> {
	const keys = new Set<string>();
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const match = trimmed.match(LINE_RE);
		if (match) keys.add(match[1]);
	}
	return keys;
}

function extractHeaderComments(raw: string): string {
	const lines = raw.split("\n");
	const header: string[] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			header.push(line);
			continue;
		}
		break;
	}
	// Drop trailing blank lines from the header
	while (header.length > 0 && header[header.length - 1].trim() === "") {
		header.pop();
	}
	return header.join("\n");
}

function renderExample(header: string, keys: readonly string[]): string {
	const headerBlock = header.trim() || "# tala - required environment keys";
	const body = keys.map((k) => `${k}=`).join("\n");
	return `${headerBlock}\n\n${body}\n\n# Add new keys here or let \`tala env sync\` regenerate them from tool env[] metadata.\n`;
}

// -----------------------------------------------------------------------------
// Commands
// -----------------------------------------------------------------------------

export async function runEnvSync(labRoot: string): Promise<EnvSyncResult> {
	const required = collectRequiredEnv(labRoot);
	const envPath = envFilePath(labRoot);
	const examplePath = `${envPath}.example`;

	const existing = existsSync(examplePath)
		? await readFile(examplePath, "utf8")
		: "";
	const existingKeys = parseEnvKeys(existing);
	const header = extractHeaderComments(existing);

	const added = required.filter((k) => !existingKeys.has(k));
	const removed = [...existingKeys].filter((k) => !required.includes(k)).sort();

	// recursive:true is idempotent; no existence check needed.
	mkdirSync(dirname(examplePath), { recursive: true });

	await writeFile(examplePath, renderExample(header, required));

	return {
		success: true,
		examplePath,
		keysWritten: required,
		added,
		removed,
	};
}

export async function runEnvCheck(labRoot: string): Promise<EnvCheckResult> {
	const required = collectRequiredEnv(labRoot);
	const envPath = envFilePath(labRoot);

	const existing = existsSync(envPath) ? await readFile(envPath, "utf8") : "";
	const activeKeys = parseEnvKeys(existing);

	const missing = required.filter((k) => !activeKeys.has(k));
	const present = required.filter((k) => activeKeys.has(k));
	const surplus = [...activeKeys].filter((k) => !required.includes(k)).sort();

	return {
		success: missing.length === 0,
		envFile: envPath,
		required,
		missing,
		present,
		surplus,
	};
}
