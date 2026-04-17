// Project-level config loaded from .tala/config.json with defaults.
//
// `tala init` writes config.json based on wizard answers. Commands resolve
// paths through this loader rather than hardcoding `topics/` or `tools/`,
// so users who picked a nested layout (.tala/topics, .tala/tools) get the
// same command behavior as inline users.
//
// Design: sync load, cached per labRoot, never reloaded mid-run. If the
// file is missing/unreadable/malformed, we silently fall back to defaults -
// this preserves behavior for any project without `tala init` run yet.

import { join } from "node:path";
import { Option, Schema } from "effect";
import { resolveRelativePath, safeReadJson } from "./config-io";

export const TalaConfigSchema = Schema.Struct({
	topicsDir: Schema.optional(Schema.String),
	toolsDir: Schema.optional(Schema.String),
	cacheDir: Schema.optional(Schema.String),
	envFile: Schema.optional(Schema.String),
	apis: Schema.optional(Schema.Array(Schema.String)),
});

export type TalaConfig = typeof TalaConfigSchema.Type;

export interface ResolvedConfig {
	labRoot: string;
	topicsDir: string;
	toolsDir: string;
	cacheDir: string;
	envFile: string;
	apis: readonly string[];
}

const DEFAULTS = {
	topicsDir: "./topics",
	toolsDir: "./tools",
	cacheDir: "./.cache",
	envFile: "./.tala/.env",
	apis: [] as readonly string[],
};

// Decode the raw JSON via Schema; on decode failure return None so the
// caller falls back to defaults. No try/catch, no null sentinels.
function decodeConfig(raw: unknown): Option.Option<TalaConfig> {
	return Option.flatMap(Option.fromNullishOr(raw), (r) =>
		Schema.decodeUnknownOption(TalaConfigSchema)(r),
	);
}

const cache = new Map<string, ResolvedConfig>();

function computeAndCache(labRoot: string): ResolvedConfig {
	const configPath = join(labRoot, ".tala", "config.json");
	const configOpt = decodeConfig(safeReadJson(configPath));

	// Fold the config Option into a flat record with defaults applied once,
	// so the ResolvedConfig literal below is just plain field access.
	const fields = Option.match(configOpt, {
		onNone: () => DEFAULTS,
		onSome: (c) => ({
			topicsDir: c.topicsDir ?? DEFAULTS.topicsDir,
			toolsDir: c.toolsDir ?? DEFAULTS.toolsDir,
			cacheDir: c.cacheDir ?? DEFAULTS.cacheDir,
			envFile: c.envFile ?? DEFAULTS.envFile,
			apis: c.apis ?? DEFAULTS.apis,
		}),
	});

	const resolved: ResolvedConfig = {
		labRoot,
		topicsDir: resolveRelativePath(labRoot, fields.topicsDir),
		toolsDir: resolveRelativePath(labRoot, fields.toolsDir),
		cacheDir: resolveRelativePath(labRoot, fields.cacheDir),
		envFile: resolveRelativePath(labRoot, fields.envFile),
		apis: fields.apis,
	};

	cache.set(labRoot, resolved);
	return resolved;
}

export function loadConfig(labRoot: string): ResolvedConfig {
	return Option.match(Option.fromNullishOr(cache.get(labRoot)), {
		onSome: (c) => c,
		onNone: () => computeAndCache(labRoot),
	});
}

// Test helper - clears the module-level cache between test runs.
export function clearConfigCache(): void {
	cache.clear();
}

// -----------------------------------------------------------------------------
// Path helpers
//
// Every command that used to build paths by hand now goes through these so
// nested-layout users (.tala/topics/) get the same behavior as inline users.
// -----------------------------------------------------------------------------

export function topicsRoot(labRoot: string): string {
	return loadConfig(labRoot).topicsDir;
}

export function topicDir(labRoot: string, slug: string): string {
	return join(topicsRoot(labRoot), slug);
}

export function hubPath(labRoot: string, slug: string): string {
	return join(topicDir(labRoot, slug), `${slug}.md`);
}

export function toolsRoot(labRoot: string): string {
	return loadConfig(labRoot).toolsDir;
}

export function toolPath(labRoot: string, name: string): string {
	return join(toolsRoot(labRoot), `${name}.ts`);
}

export function cacheRoot(labRoot: string): string {
	return loadConfig(labRoot).cacheDir;
}

export function envFilePath(labRoot: string): string {
	return loadConfig(labRoot).envFile;
}
