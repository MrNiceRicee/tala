import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect, Option, Predicate, Schema, Stdio } from "effect";

export interface ToolDefinition<A, I> {
	name: string;
	args: Schema.Codec<A, I>;
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
	const effect = Effect.tryPromise({
		try: () => Bun.file(path).text(),
		catch: (e) => wrapError(`failed to read file: ${path}`, e),
	});
	return effect;
}

export function readJsonFile<A, I>(path: string, schema: Schema.Codec<A, I>) {
	return Effect.gen(function* () {
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
}

export function fetchJson<A, I>(
	url: string,
	init: RequestInit,
	schema: Schema.Codec<A, I>,
) {
	return Effect.gen(function* () {
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
}

export function defineTool<A, I>(def: ToolDefinition<A, I>): void {
	const program = Effect.gen(function* () {
		const argv = yield* Stdio.Stdio.use((s) => s.args);
		const raw = parseArgv(argv.slice(2));
		const args = yield* Effect.try({
			try: () => Schema.decodeUnknownSync(def.args)(raw),
			catch: (e) => wrapError(`invalid args for tool "${def.name}"`, e),
		});
		const output = yield* def.run(args);
		yield* Console.log(output);
	});

	program.pipe(Effect.provide(BunServices.layer), BunRuntime.runMain);
}
