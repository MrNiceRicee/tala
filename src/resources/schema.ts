// `tala get schema` - reflects on internal schemas for agents + humans.
//
// Not a data-file walker like topics. Exposes a small, curated set of
// framework facts: claim markers, severity table, frontmatter shape.
// Useful for agents to look up "what markers are valid" without reading
// the source, and for humans who forgot which status level an error
// escalates at.

import { CLAIM_MARKERS, MARKER_SEVERITY } from "../schema";
import type { Resource } from "./types";

export interface SchemaMeta {
	name: string;
	description: string;
}

export interface SchemaDetail extends SchemaMeta {
	kind: "enum" | "table" | "struct";
	entries: unknown;
}

const SCHEMAS: Record<string, SchemaDetail> = {
	"claim-markers": {
		name: "claim-markers",
		description: "Marker labels usable inside topic claims",
		kind: "enum",
		entries: Object.values(CLAIM_MARKERS).map((m) => ({
			label: m.label,
			description: m.description,
		})),
	},
	severity: {
		name: "severity",
		description:
			"Per-status severity for each marker (sketch/working/distilled)",
		kind: "table",
		entries: MARKER_SEVERITY,
	},
	frontmatter: {
		name: "frontmatter",
		description: "Required + optional fields per note type",
		kind: "struct",
		entries: {
			required: {
				type: "hub | source | note | computation",
				title: "string",
				status: "sketch | working | distilled",
				created: "YYYY-MM-DD",
				updated: "YYYY-MM-DD",
			},
			optional: {
				source: { url: "string", author: "string", accessed: "YYYY-MM-DD" },
				hub: { slug: "string", tags: "string[]", domain: "string" },
				computation: { tool: "string", args: "string[]", ran_at: "YYYY-MM-DD" },
			},
		},
	},
};

function pad(s: string, width: number): string {
	return s.length >= width ? s : s + " ".repeat(width - s.length);
}

async function list(): Promise<SchemaMeta[]> {
	return Object.values(SCHEMAS).map((s) => ({
		name: s.name,
		description: s.description,
	}));
}

async function get(_ctx: unknown, name: string): Promise<SchemaDetail | null> {
	return SCHEMAS[name] ?? null;
}

function renderList(items: SchemaMeta[]): string {
	if (items.length === 0) return "no schemas";
	const nameWidth = Math.max(...items.map((i) => i.name.length), 5);
	const lines: string[] = [`${pad("NAME", nameWidth)}  DESCRIPTION`];
	for (const item of items) {
		lines.push(`${pad(item.name, nameWidth)}  ${item.description}`);
	}
	return lines.join("\n");
}

function renderDetail(detail: SchemaDetail): string {
	return [
		`${detail.name}   (${detail.kind})`,
		"",
		detail.description,
		"",
		JSON.stringify(detail.entries, null, 2),
	].join("\n");
}

function serializeList(items: SchemaMeta[]): unknown {
	return items;
}

function serializeDetail(detail: SchemaDetail): unknown {
	return detail;
}

export const schemaResource: Resource<SchemaMeta, SchemaDetail> = {
	name: "schema",
	description: "framework schemas (claim markers, severity, frontmatter)",
	list,
	get,
	renderList,
	renderDetail,
	serializeList,
	serializeDetail,
};
