import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "../parser/frontmatter";
import { CLAIM_MARKER_LABELS } from "../schema";
import type {
	ListFilters,
	Resource,
	ResourceContext,
	ResourceView,
} from "./types";

export interface TopicMeta {
	slug: string;
	title: string;
	status: string;
	updated: string;
	description: string;
}

export interface Claim {
	text: string;
	marker: string;
	file: string;
	line: number;
	sourceLink: string | null;
}

export interface SourceMeta {
	slug: string;
	title: string;
	status: string;
	url: string | null;
	path: string;
}

export interface ComputationMeta {
	name: string;
	title: string;
	ranAt: string | null;
	tool: string | null;
	args: string[];
	path: string;
}

export interface HubContent {
	intent: string;
	questions: string[];
	findings: string;
	raw: string;
}

export interface TopicDetail extends TopicMeta {
	hub: HubContent;
	claims: Claim[];
	sources: SourceMeta[];
	computations: ComputationMeta[];
}

const topicsDir = (labRoot: string) => join(labRoot, "topics");

function getString(
	data: Record<string, unknown>,
	key: string,
	fallback = "",
): string {
	const value = data[key];
	return typeof value === "string" ? value : fallback;
}

function getStringArray(data: Record<string, unknown>, key: string): string[] {
	const value = data[key];
	if (!Array.isArray(value)) return [];
	const result: string[] = [];
	for (const v of value) {
		if (typeof v === "string") result.push(v);
	}
	return result;
}

// Extract the first ~120 chars of the Intent section as a description.
// Falls back to the first non-heading line of content if no Intent section.
function extractDescription(content: string): string {
	const intent = extractSection(content, "Intent");
	const source = intent || firstProseLine(content);
	const trimmed = source.replace(/\s+/g, " ").trim();
	return trimmed.length <= 120 ? trimmed : `${trimmed.slice(0, 117)}...`;
}

function firstProseLine(content: string): string {
	const lines = content.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (trimmed.startsWith("#")) continue;
		if (trimmed.startsWith("---")) continue;
		return trimmed;
	}
	return "";
}

// Extract body text under a given `# Heading` or `## Heading`.
// Stops at the next heading at the same or higher level.
function extractSection(content: string, heading: string): string {
	const lines = content.split("\n");
	const headingRegex = new RegExp(`^#{1,3}\\s+${heading}\\s*$`, "i");
	let startIdx = -1;
	let startLevel = 0;

	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].match(/^(#+)\s+(.+?)\s*$/);
		if (!match) continue;
		if (headingRegex.test(lines[i])) {
			startIdx = i + 1;
			startLevel = match[1].length;
			break;
		}
	}

	if (startIdx === -1) return "";

	const body: string[] = [];
	for (let i = startIdx; i < lines.length; i++) {
		const match = lines[i].match(/^(#+)\s+/);
		if (match && match[1].length <= startLevel) break;
		body.push(lines[i]);
	}

	return body.join("\n").trim();
}

function extractQuestions(content: string): string[] {
	const section = extractSection(content, "Questions");
	if (!section) return [];
	const questions: string[] = [];
	for (const line of section.split("\n")) {
		const match = line.match(/^\s*[-*]\s+(.+?)\s*$/);
		if (match) questions.push(match[1]);
	}
	return questions;
}

// Matches `*(marker-name)*` OR `[[path|label]]` OR `[[path]]` anywhere in a line.
const MARKER_RE = /\*\(([a-z-]+)\)\*/g;
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

function extractClaims(
	content: string,
	relativePath: string,
	markerLabels: readonly string[],
): Claim[] {
	const claims: Claim[] = [];
	const lines = content.split("\n");
	const markerSet = new Set(markerLabels);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (
			!trimmed.startsWith("-") &&
			!trimmed.startsWith("*") &&
			!/^\d/.test(trimmed)
		) {
			continue;
		}
		if (trimmed.startsWith("#")) continue;

		const markers = Array.from(line.matchAll(MARKER_RE))
			.map((m) => m[1])
			.filter((m) => markerSet.has(m));
		const wikilinks = Array.from(line.matchAll(WIKILINK_RE)).map((m) => m[1]);

		if (markers.length === 0 && wikilinks.length === 0) continue;

		const marker = markers[0] ?? "verified";
		const sourceLink = wikilinks[0] ?? null;

		claims.push({
			text: trimmed.replace(/^[-*\d.]+\s*/, ""),
			marker,
			file: relativePath,
			line: i + 1,
			sourceLink,
		});
	}

	return claims;
}

async function readMarkdownFile(path: string): Promise<{
	data: Record<string, unknown>;
	content: string;
} | null> {
	if (!existsSync(path)) return null;
	const raw = await readFile(path, "utf8");
	const parsed = parseFrontmatter(raw);
	if (!parsed.ok) return null;
	return { data: parsed.value.data, content: parsed.value.content };
}

async function readTopicMeta(
	topicRoot: string,
	slug: string,
): Promise<TopicMeta | null> {
	const hubPath = join(topicRoot, `${slug}.md`);
	const parsed = await readMarkdownFile(hubPath);
	if (!parsed) return null;
	return {
		slug,
		title: getString(parsed.data, "title", slug),
		status: getString(parsed.data, "status", "sketch"),
		updated: getString(parsed.data, "updated", ""),
		description: extractDescription(parsed.content),
	};
}

async function readSources(topicRoot: string): Promise<SourceMeta[]> {
	const dir = join(topicRoot, "sources");
	if (!existsSync(dir)) return [];
	const files = await readdir(dir);
	const sources: SourceMeta[] = [];
	for (const file of files) {
		if (!file.endsWith(".md")) continue;
		const slug = file.replace(/\.md$/, "");
		const parsed = await readMarkdownFile(join(dir, file));
		if (!parsed) continue;
		sources.push({
			slug,
			title: getString(parsed.data, "title", slug),
			status: getString(parsed.data, "status", "sketch"),
			url: getString(parsed.data, "url") || null,
			path: `sources/${file}`,
		});
	}
	sources.sort((a, b) => a.slug.localeCompare(b.slug));
	return sources;
}

async function readComputations(topicRoot: string): Promise<ComputationMeta[]> {
	const dir = join(topicRoot, "computations");
	if (!existsSync(dir)) return [];
	const files = await readdir(dir);
	const comps: ComputationMeta[] = [];
	for (const file of files) {
		if (!file.endsWith(".md")) continue;
		const name = file.replace(/\.output\.md$/, "").replace(/\.md$/, "");
		const parsed = await readMarkdownFile(join(dir, file));
		if (!parsed) continue;
		comps.push({
			name,
			title: getString(parsed.data, "title", name),
			ranAt: getString(parsed.data, "ran_at") || null,
			tool: getString(parsed.data, "tool") || null,
			args: getStringArray(parsed.data, "args"),
			path: `computations/${file}`,
		});
	}
	comps.sort((a, b) => a.name.localeCompare(b.name));
	return comps;
}

async function readAllClaims(
	topicRoot: string,
	slug: string,
): Promise<Claim[]> {
	const all: Claim[] = [];
	const hubPath = join(topicRoot, `${slug}.md`);
	const hub = await readMarkdownFile(hubPath);
	if (hub)
		all.push(...extractClaims(hub.content, `${slug}.md`, CLAIM_MARKER_LABELS));

	for (const subdir of ["sources", "notes", "computations"]) {
		const dir = join(topicRoot, subdir);
		if (!existsSync(dir)) continue;
		const files = await readdir(dir);
		for (const file of files) {
			if (!file.endsWith(".md")) continue;
			const parsed = await readMarkdownFile(join(dir, file));
			if (!parsed) continue;
			all.push(
				...extractClaims(
					parsed.content,
					`${subdir}/${file}`,
					CLAIM_MARKER_LABELS,
				),
			);
		}
	}

	return all;
}

function claimSummary(claims: Claim[]): Record<string, number> {
	const counts: Record<string, number> = { verified: 0 };
	for (const label of CLAIM_MARKER_LABELS) counts[label] = 0;
	for (const claim of claims) {
		counts[claim.marker] = (counts[claim.marker] ?? 0) + 1;
	}
	return counts;
}

// ---------- Resource implementation ----------

async function list(
	ctx: ResourceContext,
	filters: ListFilters,
): Promise<TopicMeta[]> {
	const dir = topicsDir(ctx.labRoot);
	if (!existsSync(dir)) return [];

	const entries = await readdir(dir, { withFileTypes: true });
	const metas: TopicMeta[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const meta = await readTopicMeta(join(dir, entry.name), entry.name);
		if (!meta) continue;
		if (filters.status && meta.status !== filters.status) continue;
		metas.push(meta);
	}

	metas.sort((a, b) => a.slug.localeCompare(b.slug));
	return metas;
}

async function get(
	ctx: ResourceContext,
	slug: string,
): Promise<TopicDetail | null> {
	const topicRoot = join(topicsDir(ctx.labRoot), slug);
	if (!existsSync(topicRoot)) return null;

	const meta = await readTopicMeta(topicRoot, slug);
	if (!meta) return null;

	const hubPath = join(topicRoot, `${slug}.md`);
	const hubParsed = await readMarkdownFile(hubPath);
	const content = hubParsed?.content ?? "";

	const hub: HubContent = {
		intent: extractSection(content, "Intent"),
		questions: extractQuestions(content),
		findings: extractSection(content, "Findings"),
		raw: content,
	};

	const [claims, sources, computations] = await Promise.all([
		readAllClaims(topicRoot, slug),
		readSources(topicRoot),
		readComputations(topicRoot),
	]);

	return { ...meta, hub, claims, sources, computations };
}

// ---------- Rendering ----------

function pad(s: string, width: number): string {
	return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function renderList(items: TopicMeta[]): string {
	if (items.length === 0) return "no topics found";
	const slugWidth = Math.max(...items.map((i) => i.slug.length), 4);
	const statusWidth = Math.max(...items.map((i) => i.status.length), 6);

	const lines: string[] = [
		`${pad("SLUG", slugWidth)}  ${pad("STATUS", statusWidth)}  UPDATED     DESCRIPTION`,
	];
	for (const item of items) {
		lines.push(
			`${pad(item.slug, slugWidth)}  ${pad(item.status, statusWidth)}  ${pad(item.updated || "-", 10)}  ${item.description}`,
		);
	}
	return lines.join("\n");
}

function renderDetail(detail: TopicDetail, fullMode: boolean): string {
	if (fullMode) return detail.hub.raw;

	const counts = claimSummary(detail.claims);
	const countLines = Object.entries(counts)
		.filter(([, n]) => n > 0)
		.map(([marker, n]) => `  ${marker.padEnd(16)} ${n}`);

	return [
		`${detail.slug}   ${detail.status}   updated ${detail.updated || "-"}`,
		detail.title ? `\n${detail.title}` : "",
		detail.hub.intent
			? `\nintent\n  ${detail.hub.intent.split("\n").join("\n  ")}`
			: "",
		detail.hub.questions.length > 0
			? `\nquestions (${detail.hub.questions.length})\n${detail.hub.questions.map((q) => `  - ${q}`).join("\n")}`
			: "",
		countLines.length > 0
			? `\nclaims (${detail.claims.length})\n${countLines.join("\n")}`
			: "",
		detail.sources.length > 0
			? `\nsources (${detail.sources.length})\n${detail.sources.map((s) => `  ${pad(s.slug, 20)} ${pad(s.status, 10)} ${s.title}`).join("\n")}`
			: "",
		detail.computations.length > 0
			? `\ncomputations (${detail.computations.length})\n${detail.computations.map((c) => `  ${pad(c.name, 20)} ${c.ranAt ?? "-"}   ${c.tool ?? "-"}`).join("\n")}`
			: "",
	]
		.filter(Boolean)
		.join("\n");
}

function serializeList(items: TopicMeta[]): unknown {
	return items;
}

function serializeDetail(detail: TopicDetail, fullMode: boolean): unknown {
	if (fullMode) return detail;
	return {
		slug: detail.slug,
		title: detail.title,
		status: detail.status,
		updated: detail.updated,
		description: detail.description,
		intent: detail.hub.intent,
		questions: detail.hub.questions,
		claimCounts: claimSummary(detail.claims),
		sources: detail.sources.map((s) => ({
			slug: s.slug,
			title: s.title,
			status: s.status,
		})),
		computations: detail.computations.map((c) => ({
			name: c.name,
			ranAt: c.ranAt,
			tool: c.tool,
		})),
	};
}

// ---------- Views ----------

const claimsView: ResourceView<TopicDetail> = {
	name: "claims",
	filters: {
		marker:
			"filter by marker (unsupported, single-source, hypothesis, contradicted, verified)",
	},
	renderMarkdown: (detail, filters) => {
		const filtered = filters.marker
			? detail.claims.filter((c) => c.marker === filters.marker)
			: detail.claims;
		if (filtered.length === 0) return "no claims";
		const lines: string[] = [
			`${pad("MARKER", 16)}  ${pad("FILE:LINE", 36)}  CLAIM`,
		];
		for (const c of filtered) {
			const loc = `${c.file}:${c.line}`;
			const text = c.text.length > 80 ? `${c.text.slice(0, 77)}...` : c.text;
			lines.push(`${pad(c.marker, 16)}  ${pad(loc, 36)}  ${text}`);
		}
		return lines.join("\n");
	},
	serialize: (detail, filters) => {
		const filtered = filters.marker
			? detail.claims.filter((c) => c.marker === filters.marker)
			: detail.claims;
		return filtered;
	},
};

const sourcesView: ResourceView<TopicDetail> = {
	name: "sources",
	renderMarkdown: (detail) => {
		if (detail.sources.length === 0) return "no sources";
		return detail.sources
			.map(
				(s) =>
					`${pad(s.slug, 24)}  ${pad(s.status, 10)}  ${s.title}${s.url ? `   ${s.url}` : ""}`,
			)
			.join("\n");
	},
	serialize: (detail) => detail.sources,
};

const computationsView: ResourceView<TopicDetail> = {
	name: "computations",
	renderMarkdown: (detail) => {
		if (detail.computations.length === 0) return "no computations";
		return detail.computations
			.map((c) => `${pad(c.name, 24)}  ${c.ranAt ?? "-"}   ${c.tool ?? "-"}`)
			.join("\n");
	},
	serialize: (detail) => detail.computations,
};

export const topicsResource: Resource<TopicMeta, TopicDetail> = {
	name: "topics",
	description: "research topics with hub, sources, notes, and computations",
	list,
	get,
	renderList,
	renderDetail,
	serializeList,
	serializeDetail,
	views: [claimsView, sourcesView, computationsView],
};
