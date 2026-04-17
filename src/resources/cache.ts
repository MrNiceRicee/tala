import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheRoot } from "../config";
import type { Resource, ResourceContext, ResourceView } from "./types";

export interface CacheEntryMeta {
	hash: string;
	size: number;
	fetchedAt: string;
	expiresAt: string;
	fresh: boolean;
}

export interface CacheEntryDetail extends CacheEntryMeta {
	path: string;
	dataPreview: string;
}

function pad(s: string, width: number): string {
	return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function humanSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}k`;
	return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}

function isFresh(expiresAt: string): boolean {
	return Date.now() < new Date(expiresAt).getTime();
}

interface ParsedEntry {
	fetchedAt: string;
	expiresAt: string;
	data: unknown;
}

function isParsedEntry(value: unknown): value is ParsedEntry {
	if (typeof value !== "object" || value === null) return false;
	if (!("fetchedAt" in value) || typeof value.fetchedAt !== "string") {
		return false;
	}
	if (!("expiresAt" in value) || typeof value.expiresAt !== "string") {
		return false;
	}
	return true;
}

function readEntry(path: string): ParsedEntry | null {
	if (!existsSync(path)) return null;
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
		return isParsedEntry(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function meta(cacheDir: string, filename: string): CacheEntryMeta | null {
	const path = join(cacheDir, filename);
	const entry = readEntry(path);
	if (!entry) return null;
	const stat = statSync(path);
	return {
		hash: filename.replace(/\.json$/, ""),
		size: stat.size,
		fetchedAt: entry.fetchedAt,
		expiresAt: entry.expiresAt,
		fresh: isFresh(entry.expiresAt),
	};
}

async function detail(
	cacheDir: string,
	hash: string,
): Promise<CacheEntryDetail | null> {
	const path = join(cacheDir, `${hash}.json`);
	const entry = readEntry(path);
	if (!entry) return null;
	const raw = await readFile(path, "utf8");
	const stat = statSync(path);
	const dataStr = JSON.stringify(entry.data, null, 2);
	const preview =
		dataStr.length > 500 ? `${dataStr.slice(0, 497)}...` : dataStr;
	return {
		hash,
		size: stat.size,
		fetchedAt: entry.fetchedAt,
		expiresAt: entry.expiresAt,
		fresh: isFresh(entry.expiresAt),
		path,
		dataPreview: `// raw length: ${raw.length}\n${preview}`,
	};
}

async function list(ctx: ResourceContext): Promise<CacheEntryMeta[]> {
	const dir = cacheRoot(ctx.labRoot);
	if (!existsSync(dir)) return [];
	const files = readdirSync(dir);
	const metas: CacheEntryMeta[] = [];
	for (const file of files) {
		if (!file.endsWith(".json")) continue;
		const m = meta(dir, file);
		if (m) metas.push(m);
	}
	metas.sort((a, b) => a.hash.localeCompare(b.hash));
	return metas;
}

async function get(
	ctx: ResourceContext,
	hash: string,
): Promise<CacheEntryDetail | null> {
	return detail(cacheRoot(ctx.labRoot), hash);
}

function renderList(items: CacheEntryMeta[]): string {
	if (items.length === 0) return "no cache entries";
	const hashWidth = Math.max(...items.map((i) => i.hash.length), 4);
	const lines: string[] = [
		`${pad("HASH", hashWidth)}  ${pad("SIZE", 6)}  STATE   FETCHED              EXPIRES`,
	];
	for (const item of items) {
		lines.push(
			`${pad(item.hash, hashWidth)}  ${pad(humanSize(item.size), 6)}  ${pad(item.fresh ? "fresh" : "stale", 6)}  ${item.fetchedAt}  ${item.expiresAt}`,
		);
	}
	return lines.join("\n");
}

function renderDetail(detail: CacheEntryDetail): string {
	return [
		`${detail.hash}   ${detail.fresh ? "fresh" : "stale"}`,
		"",
		`size:      ${humanSize(detail.size)}`,
		`fetched:   ${detail.fetchedAt}`,
		`expires:   ${detail.expiresAt}`,
		`path:      ${detail.path}`,
		"",
		"data (preview):",
		detail.dataPreview,
	].join("\n");
}

function serializeList(items: CacheEntryMeta[]): unknown {
	return items;
}

function serializeDetail(detail: CacheEntryDetail): unknown {
	return detail;
}

const staleView: ResourceView<CacheEntryDetail> = {
	name: "stale",
	renderMarkdown: (d) =>
		d.fresh ? "entry is fresh, no output" : renderDetail(d),
	serialize: (d) => (d.fresh ? null : d),
};

const freshView: ResourceView<CacheEntryDetail> = {
	name: "fresh",
	renderMarkdown: (d) =>
		d.fresh ? renderDetail(d) : "entry is stale, no output",
	serialize: (d) => (d.fresh ? d : null),
};

export const cacheResource: Resource<CacheEntryMeta, CacheEntryDetail> = {
	name: "cache",
	description: "HTTP cache entries under the configured cacheDir",
	list,
	get,
	renderList,
	renderDetail,
	serializeList,
	serializeDetail,
	views: [staleView, freshView],
};
