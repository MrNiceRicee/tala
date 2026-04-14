import { Option, Schema } from "effect";

export const EnvSchema = Schema.Struct({
	OPENROUTESERVICE_API_KEY: Schema.optional(Schema.String),
	HERE_API_KEY: Schema.optional(Schema.String),
});

export type Env = typeof EnvSchema.Type;

export function parseEnv(
	source: Record<string, string | undefined> = Bun.env,
): Env {
	return Schema.decodeUnknownSync(EnvSchema)(source);
}

export const env: Env = parseEnv();

function formatToolHint(tool: string | undefined): string {
	return Option.match(Option.fromNullishOr(tool), {
		onNone: () => "",
		onSome: (t) => ` (required by tool: ${t})`,
	});
}

function presentValue(value: string | undefined): Option.Option<string> {
	return Option.fromNullishOr(value).pipe(Option.filter((v) => v.length > 0));
}

export function requireKey<K extends keyof Env>(
	name: K,
	context?: { tool?: string; env?: Env },
): string {
	const source = context?.env ?? env;
	const value = source[name];
	const toolHint = formatToolHint(context?.tool);

	return Option.match(presentValue(value), {
		onNone: () => {
			throw new Error(
				`missing env var: ${String(name)}${toolHint}\nadd it to .env at the repo root. see .env.example for the template.`,
			);
		},
		onSome: (v) => v,
	});
}
