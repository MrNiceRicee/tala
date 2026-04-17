import { findResource, RESOURCES } from "../resources/registry";
import type { ListFilters, Resource } from "../resources/types";

export interface GetArgs {
	resource?: string;
	name?: string;
	view?: string;
	fullMode: boolean;
	format: "markdown" | "json";
	filters: Record<string, string>;
}

export interface GetResult {
	success: boolean;
	output: string;
	error?: string;
}

function ok(output: string): GetResult {
	return { success: true, output };
}

function fail(error: string): GetResult {
	return { success: false, output: "", error };
}

function renderCatalog(): string {
	const rows = RESOURCES.map((r) => `  ${r.name.padEnd(12)} ${r.description}`);
	return [
		"resources:",
		"",
		...rows,
		"",
		"run `tala get <resource>` to list",
		"run `tala get <resource> <name>` for detail",
	].join("\n");
}

function serializeCatalog(): unknown {
	return RESOURCES.map((r) => ({ name: r.name, description: r.description }));
}

async function handleList(
	resource: Resource,
	ctx: { labRoot: string },
	args: GetArgs,
): Promise<GetResult> {
	const listFilters: ListFilters = {};
	if (args.filters.status) listFilters.status = args.filters.status;

	const items = await resource.list(ctx, listFilters);
	if (args.format === "json") {
		return ok(JSON.stringify(resource.serializeList(items), null, 2));
	}
	return ok(resource.renderList(items));
}

async function handleDetail(
	resource: Resource,
	ctx: { labRoot: string },
	args: GetArgs,
	name: string,
): Promise<GetResult> {
	if (!resource.get) {
		return fail(`resource "${resource.name}" does not support detail view`);
	}
	const detail = await resource.get(ctx, name);
	if (detail === null) {
		return fail(`${resource.name} "${name}" not found`);
	}

	// View branch
	if (args.view) {
		const view = resource.views?.find((v) => v.name === args.view);
		if (!view) {
			const names = (resource.views ?? []).map((v) => v.name).join(", ");
			return fail(
				`unknown view "${args.view}" for ${resource.name}. available: ${names || "none"}`,
			);
		}
		if (args.format === "json") {
			return ok(JSON.stringify(view.serialize(detail, args.filters), null, 2));
		}
		return ok(view.renderMarkdown(detail, args.filters));
	}

	// Default detail branch
	if (args.format === "json") {
		const serialized = resource.serializeDetail
			? resource.serializeDetail(detail, args.fullMode)
			: detail;
		return ok(JSON.stringify(serialized, null, 2));
	}
	if (!resource.renderDetail) {
		return fail(
			`resource "${resource.name}" does not support markdown rendering`,
		);
	}
	return ok(resource.renderDetail(detail, args.fullMode));
}

export async function runGet(
	labRoot: string,
	args: GetArgs,
): Promise<GetResult> {
	// Root catalog
	if (!args.resource) {
		return args.format === "json"
			? ok(JSON.stringify(serializeCatalog(), null, 2))
			: ok(renderCatalog());
	}

	const resource = findResource(args.resource);
	if (!resource) {
		const known = RESOURCES.map((r) => r.name).join(", ");
		return fail(`unknown resource "${args.resource}". available: ${known}`);
	}

	const ctx = { labRoot };
	return args.name
		? handleDetail(resource, ctx, args, args.name)
		: handleList(resource, ctx, args);
}

// CLI arg parser. Shapes:
//   tala get                                       -> { }
//   tala get <resource>                            -> { resource }
//   tala get <resource> <name>                     -> { resource, name }
//   tala get <resource> <name> --<view>            -> { resource, name, view }
//   tala get ... --format json --full --marker X   -> { ..., format, fullMode, filters: { marker: X } }
//
// View flags: any resource.views[i].name becomes a boolean flag that sets
// args.view. If the view declares `filters`, those become string flags that
// populate args.filters.
const KNOWN_FLAGS = new Set(["full", "format", "status"]);

function viewNames(): Set<string> {
	const names = new Set<string>();
	for (const r of RESOURCES) {
		for (const v of r.views ?? []) names.add(v.name);
	}
	return names;
}

function viewFilterNames(): Set<string> {
	const names = new Set<string>();
	for (const r of RESOURCES) {
		for (const v of r.views ?? []) {
			for (const filter of Object.keys(v.filters ?? {})) {
				names.add(filter);
			}
		}
	}
	return names;
}

export function parseGetArgs(argv: readonly string[]): GetArgs {
	const views = viewNames();
	const viewFilters = viewFilterNames();

	const positional: string[] = [];
	const filters: Record<string, string> = {};
	let view: string | undefined;
	let fullMode = false;
	let format: "markdown" | "json" = "markdown";

	let i = 0;
	while (i < argv.length) {
		const arg = argv[i];
		if (!arg.startsWith("--")) {
			positional.push(arg);
			i += 1;
			continue;
		}
		const key = arg.slice(2);

		if (views.has(key)) {
			view = key;
			i += 1;
			continue;
		}
		if (key === "full") {
			fullMode = true;
			i += 1;
			continue;
		}
		if (key === "format") {
			const next = argv[i + 1];
			format = next === "json" ? "json" : "markdown";
			i += 2;
			continue;
		}
		if (key === "status" || viewFilters.has(key)) {
			const next = argv[i + 1];
			if (typeof next === "string" && !next.startsWith("--")) {
				filters[key] = next;
				i += 2;
			} else {
				i += 1;
			}
			continue;
		}
		// Unknown flag: skip silently (forward-compat)
		i += 1;
		// Consume a value token if it looks like one
		const next = argv[i];
		if (
			typeof next === "string" &&
			!next.startsWith("--") &&
			!KNOWN_FLAGS.has(key)
		) {
			i += 1;
		}
	}

	return {
		resource: positional[0],
		name: positional[1],
		view,
		fullMode,
		format,
		filters,
	};
}
