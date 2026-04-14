import { Match, Result, Schema } from "effect";
import { BaseFrontmatter } from "../schema";
import {
	normalizeDates,
	type ParseResult,
	parseMatter,
	readFileSafe,
} from "./frontmatter-parse";

export type { ParsedNote, ParseResult } from "./frontmatter-parse";

function validateFrontmatter(
	data: Record<string, unknown>,
	content: string,
): ParseResult {
	return Result.match(Schema.decodeUnknownResult(BaseFrontmatter)(data), {
		onSuccess: () =>
			({ ok: true, value: { data, content } }) satisfies ParseResult,
		onFailure: (err) =>
			({
				ok: false,
				error: `invalid frontmatter: ${String(err)}`,
			}) satisfies ParseResult,
	});
}

function parsedToResult(
	parsed: ReturnType<typeof parseMatter>,
): Result.Result<{ data: Record<string, unknown>; content: string }, string> {
	return Match.value(parsed.ok).pipe(
		Match.when(true, () =>
			// narrow: parsed.ok is true here so .data and .content exist
			Result.succeed({
				data: (parsed as Extract<typeof parsed, { ok: true }>).data,
				content: (parsed as Extract<typeof parsed, { ok: true }>).content,
			}),
		),
		Match.orElse(() =>
			Result.fail((parsed as Extract<typeof parsed, { ok: false }>).error),
		),
	);
}

export function parseFrontmatter(raw: string): ParseResult {
	return Result.match(parsedToResult(parseMatter(raw)), {
		onFailure: (err) => ({ ok: false, error: err }),
		onSuccess: ({ data, content }) =>
			Match.value(Object.keys(data).length === 0).pipe(
				Match.when(
					true,
					() =>
						({
							ok: false,
							error: "no frontmatter found",
						}) satisfies ParseResult,
				),
				Match.orElse(() => validateFrontmatter(normalizeDates(data), content)),
			),
	});
}

export async function parseFrontmatterFromFile(
	filePath: string,
): Promise<ParseResult> {
	const read = await readFileSafe(filePath);
	return Match.value(read.ok).pipe(
		Match.when(
			false,
			() =>
				({
					ok: false,
					error: (read as Extract<typeof read, { ok: false }>).error,
				}) satisfies ParseResult,
		),
		Match.orElse(() =>
			parseFrontmatter((read as Extract<typeof read, { ok: true }>).content),
		),
	);
}
