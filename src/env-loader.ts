// Loads key=value pairs from a .env file into `Bun.env` at CLI startup.
//
// Why not just rely on Bun's built-in `./.env` loading? We want the env file
// location to come from `TalaConfig.envFile` (defaults to `./.tala/.env`).
// Bun only auto-loads `./.env` at repo root. This loader bridges the gap.
//
// Precedence: process env (already in Bun.env when this runs) > env file > defaults.
// We never overwrite an existing Bun.env entry.

import { existsSync } from "node:fs";

const LINE_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;

function unquote(value: string): string {
	const first = value[0];
	const last = value[value.length - 1];
	if (value.length >= 2 && (first === '"' || first === "'") && first === last) {
		return value.slice(1, -1);
	}
	return value;
}

export async function loadEnvFile(path: string): Promise<number> {
	if (!existsSync(path)) return 0;
	const raw = await Bun.file(path).text();
	let loaded = 0;
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const match = trimmed.match(LINE_RE);
		if (!match) continue;
		const key = match[1];
		const value = unquote(match[2]);
		if (key in Bun.env) continue;
		Bun.env[key] = value;
		loaded += 1;
	}
	return loaded;
}
