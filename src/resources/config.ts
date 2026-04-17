import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, type ResolvedConfig } from "../config";
import type { Resource, ResourceContext } from "./types";

export interface ConfigMeta {
	field: string;
	value: string;
	source: "default" | "config";
}

export interface ConfigDetail extends ResolvedConfig {
	configFileExists: boolean;
	configFilePath: string;
}

function pad(s: string, width: number): string {
	return s.length >= width ? s : s + " ".repeat(width - s.length);
}

async function list(ctx: ResourceContext): Promise<ConfigMeta[]> {
	const config = loadConfig(ctx.labRoot);
	const configPath = join(ctx.labRoot, ".tala", "config.json");
	const fromFile = existsSync(configPath);

	// Mark every field as "config" if the file exists; "default" otherwise.
	// Resolved values already applied defaults, but the file's presence is
	// the best signal we have without re-parsing the raw JSON.
	const source = fromFile ? "config" : "default";
	return [
		{ field: "labRoot", value: config.labRoot, source },
		{ field: "topicsDir", value: config.topicsDir, source },
		{ field: "toolsDir", value: config.toolsDir, source },
		{ field: "cacheDir", value: config.cacheDir, source },
		{ field: "envFile", value: config.envFile, source },
		{ field: "apis", value: config.apis.join(", ") || "(none)", source },
	];
}

async function get(ctx: ResourceContext): Promise<ConfigDetail> {
	const config = loadConfig(ctx.labRoot);
	const configPath = join(ctx.labRoot, ".tala", "config.json");
	return {
		...config,
		configFileExists: existsSync(configPath),
		configFilePath: configPath,
	};
}

function renderList(items: ConfigMeta[]): string {
	if (items.length === 0) return "no config";
	const fieldWidth = Math.max(...items.map((i) => i.field.length), 5);
	const sourceWidth = Math.max(...items.map((i) => i.source.length), 6);
	const lines: string[] = [
		`${pad("FIELD", fieldWidth)}  ${pad("SOURCE", sourceWidth)}  VALUE`,
	];
	for (const item of items) {
		lines.push(
			`${pad(item.field, fieldWidth)}  ${pad(item.source, sourceWidth)}  ${item.value}`,
		);
	}
	return lines.join("\n");
}

function renderDetail(detail: ConfigDetail): string {
	return [
		`config file: ${detail.configFilePath}  (${detail.configFileExists ? "present" : "missing - using defaults"})`,
		"",
		`labRoot:    ${detail.labRoot}`,
		`topicsDir:  ${detail.topicsDir}`,
		`toolsDir:   ${detail.toolsDir}`,
		`cacheDir:   ${detail.cacheDir}`,
		`envFile:    ${detail.envFile}`,
		`apis:       ${detail.apis.join(", ") || "(none)"}`,
	].join("\n");
}

function serializeList(items: ConfigMeta[]): unknown {
	return items;
}

function serializeDetail(detail: ConfigDetail): unknown {
	return detail;
}

export const configResource: Resource<ConfigMeta, ConfigDetail> = {
	name: "config",
	description: "resolved .tala/config.json (defaults shown when file absent)",
	list,
	// config has one canonical "instance" - any name argument returns the
	// same detail (the resolved config).
	get: (ctx) => get(ctx),
	renderList,
	renderDetail,
	serializeList,
	serializeDetail,
};
