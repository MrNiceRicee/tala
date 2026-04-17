import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { toolsRoot } from "../config";
import { getRegisteredTool } from "../tool-runner";
import type { Resource, ResourceContext } from "./types";

export interface ToolMeta {
	name: string;
	description: string;
	path: string;
}

export interface ToolArgSpec {
	name: string;
	type: string;
	optional: boolean;
}

export interface ToolDetail extends ToolMeta {
	args: ToolArgSpec[];
	env: readonly string[];
	cache: { ttlMinutes: number } | null;
}

const requireTool = createRequire(import.meta.url);
// Resolves to the configured toolsDir (defaults to ./tools when no
// .tala/config.json is present).
const toolsDir = (labRoot: string) => toolsRoot(labRoot);

// Load a tool module by side effect so `defineTool(…)` registers it.
function loadTool(labRoot: string, name: string): void {
	const path = join(toolsDir(labRoot), `${name}.ts`);
	if (!existsSync(path)) return;
	try {
		requireTool(path);
	} catch {
		// swallow - tool files that throw on import are just not listable
	}
}

function listToolNames(labRoot: string): string[] {
	const dir = toolsDir(labRoot);
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

// Inspect a Schema.Struct and return a flat list of field specs. Non-struct
// schemas return empty (tools with primitive arg schemas are rare).
function hasFields(x: unknown): x is { fields: Record<string, unknown> } {
	if (typeof x !== "object" || x === null) return false;
	if (!("fields" in x)) return false;
	const f = x.fields;
	return typeof f === "object" && f !== null;
}

function fieldTag(field: unknown): string {
	if (typeof field !== "object" || field === null) return "unknown";
	if (!("ast" in field)) return "unknown";
	const ast = field.ast;
	if (typeof ast !== "object" || ast === null) return "unknown";
	if (!("_tag" in ast)) return "unknown";
	const tag = ast._tag;
	return typeof tag === "string" ? tag : "unknown";
}

function describeArgs(args: unknown): ToolArgSpec[] {
	if (!hasFields(args)) return [];
	const specs: ToolArgSpec[] = [];
	for (const [name, field] of Object.entries(args.fields)) {
		const tag = fieldTag(field);
		// Schema.optional(X) lowers to a Union with undefined in Effect v4, so
		// Union tags in a Struct arg position are treated as optional. Genuine
		// unions of concrete types are rare in CLI arg schemas.
		const optional =
			tag === "Optional" || tag === "UndefinedOr" || tag === "Union";
		// Prettier type label for the common Union-is-optional case.
		const type = tag === "Union" ? "string" : tag;
		specs.push({ name, type, optional });
	}
	return specs;
}

function buildMeta(name: string): ToolMeta {
	const def = getRegisteredTool(name);
	return {
		name,
		description: def?.description ?? "",
		path: `./tools/${name}.ts`,
	};
}

function buildDetail(name: string): ToolDetail | null {
	const def = getRegisteredTool(name);
	if (!def) return null;
	return {
		name,
		description: def.description ?? "",
		path: `./tools/${name}.ts`,
		args: describeArgs(def.args),
		env: def.env ?? [],
		cache: def.cache ?? null,
	};
}

// ---------- Resource implementation ----------

async function list(ctx: ResourceContext): Promise<ToolMeta[]> {
	const names = listToolNames(ctx.labRoot);
	for (const name of names) loadTool(ctx.labRoot, name);
	return names.map((name) => buildMeta(name));
}

async function get(
	ctx: ResourceContext,
	name: string,
): Promise<ToolDetail | null> {
	loadTool(ctx.labRoot, name);
	return buildDetail(name);
}

function pad(s: string, width: number): string {
	return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function renderList(items: ToolMeta[]): string {
	if (items.length === 0)
		return "no tools found. drop .ts files into ./tools/ to get started.";
	const nameWidth = Math.max(...items.map((i) => i.name.length), 4);
	const lines: string[] = [`${pad("NAME", nameWidth)}  DESCRIPTION`];
	for (const item of items) {
		lines.push(`${pad(item.name, nameWidth)}  ${item.description || "-"}`);
	}
	return lines.join("\n");
}

function renderDetail(detail: ToolDetail): string {
	const argLines =
		detail.args.length > 0
			? detail.args.map(
					(a) =>
						`  ${pad(a.name, 18)} ${pad(a.type, 10)} ${a.optional ? "optional" : "required"}`,
				)
			: ["  (no args)"];

	const envLines =
		detail.env.length > 0 ? detail.env.map((e) => `  ${e}`) : ["  (none)"];

	const cacheLines = detail.cache
		? `  ttl: ${detail.cache.ttlMinutes} min`
		: "  (no declared cache)";

	return [
		`${detail.name}   ${detail.description || ""}`,
		"",
		"args:",
		...argLines,
		"",
		"env:",
		...envLines,
		"",
		"cache:",
		cacheLines,
		"",
		`source: ${detail.path}`,
	].join("\n");
}

function serializeList(items: ToolMeta[]): unknown {
	return items;
}

function serializeDetail(detail: ToolDetail): unknown {
	return detail;
}

export const toolsResource: Resource<ToolMeta, ToolDetail> = {
	name: "tools",
	description: "reusable tools in ./tools/",
	list,
	get,
	renderList,
	renderDetail,
	serializeList,
	serializeDetail,
};
