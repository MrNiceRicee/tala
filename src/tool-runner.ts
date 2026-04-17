import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import {
	Console,
	Context,
	Effect,
	Option,
	Predicate,
	Schema,
	Stdio,
} from "effect";

// WorkingDir - Context.Reference holding the base directory that relative
// paths resolve against inside readTextFile/readJsonFile. The CLI overrides
// via Effect.provideService before running a tool; direct `bun tools/xxx.ts`
// invocations get the defaultValue (Bun.env.PWD or "."). Avoids process.chdir
// side effects during in-process dispatch.
const defaultCwd = () =>
	Option.getOrElse(Option.fromNullishOr(Bun.env.PWD), () => ".");

export const WorkingDir = Context.Reference<{ readonly path: string }>(
	"WorkingDir",
	{ defaultValue: () => ({ path: defaultCwd() }) },
);

export interface ToolDefinition<A, I> {
	name: string;
	// one-line summary shown by `tala get tools` and `tala get tools <name>`.
	description?: string;
	args: Schema.Codec<A, I>;
	// env keys the tool requires at runtime. Declarative so `tala init` can
	// scan registered tools and generate .env.example without a hardcoded catalog.
	env?: readonly string[];
	// cache policy the tool's `run` uses (informational; run() still calls
	// fetchJsonCached itself with these values). Lets `tala get tools <name>`
	// surface the policy without parsing the function body.
	cache?: { ttlMinutes: number };
	run: (args: A) => ReturnType<typeof readTextFile>;
}

function wrapError(context: string, e: unknown): Error {
	return Option.match(Option.liftPredicate(e, Predicate.isError), {
		onNone: () => new Error(`${context}: ${String(e)}`),
		onSome: (err) => err,
	});
}

export function parseArgv(argv: string[]): Record<string, string | boolean> {
	const result: Record<string, string | boolean> = {};
	let i = 0;
	while (i < argv.length) {
		const arg = argv[i];
		if (typeof arg === "string" && arg.startsWith("--")) {
			const key = arg.slice(2);
			const next = argv[i + 1];
			if (typeof next === "string" && !next.startsWith("--")) {
				result[key] = next;
				i += 2;
			} else {
				result[key] = true;
				i += 1;
			}
		} else {
			i += 1;
		}
	}
	return result;
}

export function readTextFile(path: string) {
	const program = Effect.gen(function* () {
		const { path: base } = yield* WorkingDir;
		const resolved = Option.getOrElse(
			Option.liftPredicate(path, isAbsolute),
			() => join(base, path),
		);
		return yield* Effect.tryPromise({
			try: () => Bun.file(resolved).text(),
			catch: (e) => wrapError(`failed to read file: ${resolved}`, e),
		});
	});
	return program;
}

export function readJsonFile<A, I>(path: string, schema: Schema.Codec<A, I>) {
	const program = Effect.gen(function* () {
		const raw = yield* readTextFile(path);
		const data = yield* Effect.try({
			try: () => JSON.parse(raw) as unknown,
			catch: (e) => wrapError(`invalid JSON in ${path}`, e),
		});
		return yield* Effect.try({
			try: () => Schema.decodeUnknownSync(schema)(data),
			catch: (e) => wrapError(`schema decode failed for ${path}`, e),
		});
	});
	return program;
}

export function fetchJson<A, I>(
	url: string,
	init: RequestInit,
	schema: Schema.Codec<A, I>,
) {
	const program = Effect.gen(function* () {
		const res = yield* Effect.tryPromise({
			try: () => fetch(url, init),
			catch: (e) => wrapError(`fetch failed for ${url}`, e),
		});
		yield* Effect.filterOrFail(
			Effect.succeed(res),
			(r) => r.ok,
			() => new Error(`HTTP ${res.status} from ${url}`),
		);
		const data = yield* Effect.tryPromise({
			try: () => res.json() as Promise<unknown>,
			catch: (e) => wrapError(`failed to parse response JSON from ${url}`, e),
		});
		return yield* Effect.try({
			try: () => Schema.decodeUnknownSync(schema)(data),
			catch: (e) =>
				wrapError(`schema decode failed for response from ${url}`, e),
		});
	});
	return program;
}

// -----------------------------------------------------------------------------
// Caching - HTTP cache keyed by hash(method + url + body). Opt-in per call via
// fetchJsonCached. Cache dir is .cache/ at repo root (gitignored).
// -----------------------------------------------------------------------------

const REPO_ROOT = dirname(import.meta.dir);
const CACHE_DIR = join(REPO_ROOT, ".cache");

// Cache schema - fetchedAt preserved for debugging, expiresAt precomputed so
// freshness is a direct comparison and TTL changes in code don't retroactively
// invalidate entries. Pre-expiresAt entries were migrated in place (jq one-shot);
// any stragglers fail decode here and fall through to refetch (safe cache miss).
const CacheEntry = Schema.Struct({
	fetchedAt: Schema.String,
	expiresAt: Schema.String,
	data: Schema.Unknown,
});
type CacheEntryType = typeof CacheEntry.Type;

function hashRequest(url: string, init: RequestInit): string {
	const method = init.method ?? "GET";
	const body = Option.getOrElse(
		Option.liftPredicate(init.body, (b): b is string => typeof b === "string"),
		() => "",
	);
	return createHash("sha256")
		.update(`${method}:${url}:${body}`)
		.digest("hex")
		.slice(0, 32);
}

function cacheFilePath(key: string): string {
	return join(CACHE_DIR, `${key}.json`);
}

function ensureCacheDir(): void {
	// recursive:true is idempotent - no existence check needed.
	mkdirSync(CACHE_DIR, { recursive: true });
}

function isFresh(entry: CacheEntryType): boolean {
	return Date.now() < new Date(entry.expiresAt).getTime();
}

// readJsonFile surfaces ENOENT as an Effect error; Effect.option turns
// missing-file and decode-failure into Option.none uniformly, so the
// existsSync check disappears.
function readCacheIfFresh(path: string) {
	const program = Effect.gen(function* () {
		const entryOpt = yield* Effect.option(readJsonFile(path, CacheEntry));
		return Option.flatMap(entryOpt, (entry) =>
			Option.liftPredicate(entry, isFresh),
		).pipe(Option.map((entry) => entry.data));
	});
	return program;
}

// ECMAScript max valid Date - ±8.64e15 ms from epoch (≈ ±275,760 years).
// Going past this produces an Invalid Date whose .toISOString() throws.
const MAX_DATE_MS = 8_640_000_000_000_000;

function computeExpiresAt(nowMs: number, ttlMinutes: number): string {
	const clamped = Option.match(
		Option.liftPredicate(ttlMinutes, Number.isFinite),
		{
			onNone: () => MAX_DATE_MS,
			onSome: (t) => Math.min(Math.max(nowMs + t * 60_000, nowMs), MAX_DATE_MS),
		},
	);
	return new Date(clamped).toISOString();
}

function writeCacheEntry(path: string, data: unknown, ttlMinutes: number) {
	const program = Effect.tryPromise({
		try: async () => {
			ensureCacheDir();
			const now = Date.now();
			const entry: CacheEntryType = {
				fetchedAt: new Date(now).toISOString(),
				expiresAt: computeExpiresAt(now, ttlMinutes),
				data,
			};
			await Bun.write(path, JSON.stringify(entry, null, 2));
		},
		catch: (e) => wrapError(`failed to write cache ${path}`, e),
	});
	return program;
}

export interface CacheOptions {
	ttlMinutes: number;
	cacheKey?: string;
}

/**
 * Cached variant of fetchJson. Results are stored under .cache/<hash>.json
 * and reused until ttlMinutes expires. Use ttlMinutes=0 to force refetch;
 * Number.POSITIVE_INFINITY (or any non-finite value) clamps expiresAt to
 * the max valid Date (~year 275760), effectively "never expires". Supply a
 * stable `cacheKey` to make cache entries human-recognizable or share keys
 * across callers.
 */
export function fetchJsonCached<A, I>(
	url: string,
	init: RequestInit,
	schema: Schema.Codec<A, I>,
	options: CacheOptions,
) {
	const program = Effect.gen(function* () {
		const key = options.cacheKey ?? hashRequest(url, init);
		const cachePath = cacheFilePath(key);

		const fetchAndCache = fetchJson(url, init, schema).pipe(
			Effect.tap((data) =>
				writeCacheEntry(cachePath, data, options.ttlMinutes),
			),
		);

		const cached = yield* readCacheIfFresh(cachePath);
		return yield* Option.match(cached, {
			onNone: () => fetchAndCache,
			onSome: (raw) =>
				Effect.try({
					try: () => Schema.decodeUnknownSync(schema)(raw),
					catch: (e) =>
						wrapError(`cache schema decode failed for ${cachePath}`, e),
				}),
		});
	});
	return program;
}

// -----------------------------------------------------------------------------
// Tool registration + dispatch
//
// Tools are loaded in-process by the CLI via dynamic import. `defineTool`
// registers the definition in a module-scoped map so the CLI can look it up
// after import. If the tool module is executed directly (e.g.,
// `bun tools/drive-matrix.ts`), `import.meta.main` is true and the tool also
// runs as a CLI via BunRuntime.runMain.
// -----------------------------------------------------------------------------

// Using `unknown` generics because downstream callers only care about the
// `name` field and the opaque `run` function; the Schema-typed args are
// applied internally by runToolInProcess.
// biome-ignore lint/suspicious/noExplicitAny: registry is deliberately heterogeneous
type AnyToolDefinition = ToolDefinition<any, any>;

const TOOL_REGISTRY = new Map<string, AnyToolDefinition>();

export function getRegisteredTool(name: string): AnyToolDefinition | undefined {
	return TOOL_REGISTRY.get(name);
}

function buildRunEffect<A, I>(def: ToolDefinition<A, I>, rawArgv: string[]) {
	return Effect.gen(function* () {
		const raw = parseArgv(rawArgv);
		const args = yield* Effect.try({
			try: () => Schema.decodeUnknownSync(def.args)(raw),
			catch: (e) => wrapError(`invalid args for tool "${def.name}"`, e),
		});
		return yield* def.run(args);
	});
}

/**
 * Runs a registered tool in the calling process. Returns the tool's output
 * string. The CLI uses this after `await import(toolPath)` to dispatch
 * without spawning a subprocess (saves ~160ms of Bun + Effect cold start).
 * `workingDir` scopes relative-path resolution inside the tool - no chdir.
 */
export async function runToolInProcess<A, I>(
	def: ToolDefinition<A, I>,
	argv: string[],
	workingDir: string,
): Promise<string> {
	return Effect.runPromise(
		buildRunEffect(def, argv).pipe(
			Effect.provideService(WorkingDir, { path: workingDir }),
			Effect.provide(BunServices.layer),
		),
	);
}

export function defineTool<A, I>(
	def: ToolDefinition<A, I>,
	meta?: ImportMeta,
): void {
	TOOL_REGISTRY.set(def.name, def);

	// Direct invocation (`bun tools/xxx.ts`) - run as CLI and exit.
	// In-process dispatch by the lab CLI imports this module without being
	// the entry point, so meta.main is false and we skip runMain.
	Option.match(
		Option.liftPredicate(meta?.main, (v) => v === true),
		{
			onNone: () => {},
			onSome: () => {
				const program = Effect.gen(function* () {
					const argv = yield* Stdio.Stdio.use((s) => s.args);
					const output = yield* buildRunEffect(def, argv.slice(2));
					yield* Console.log(output);
				});
				program.pipe(Effect.provide(BunServices.layer), BunRuntime.runMain);
			},
		},
	);
}
