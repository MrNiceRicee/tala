import { Either, Schema } from "effect";
import matter from "gray-matter";
import { BaseFrontmatter } from "../schema";

export interface ParsedNote {
	data: Record<string, unknown>;
	content: string;
}

function normalizeDates(
	data: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		result[key] =
			value instanceof Date ? value.toISOString().slice(0, 10) : value;
	}
	return result;
}

export function parseFrontmatter(
	raw: string,
): Either.Either<ParsedNote, string> {
	try {
		const { data, content } = matter(raw);

		if (!data || Object.keys(data).length === 0) {
			return Either.left("no frontmatter found");
		}

		const normalized = normalizeDates(data);
		const result = Schema.decodeUnknownEither(BaseFrontmatter)(normalized);

		if (Either.isLeft(result)) {
			return Either.left(`invalid frontmatter: ${String(result.left)}`);
		}

		return Either.right({
			data: normalized as Record<string, unknown>,
			content,
		});
	} catch (e) {
		return Either.left(`parse error: ${String(e)}`);
	}
}

export async function parseFrontmatterFromFile(
	filePath: string,
): Promise<Either.Either<ParsedNote, string>> {
	try {
		const file = Bun.file(filePath);
		const exists = await file.exists();
		if (!exists) {
			return Either.left(`file not found: ${filePath}`);
		}
		const raw = await file.text();
		return parseFrontmatter(raw);
	} catch (e) {
		return Either.left(`read error: ${String(e)}`);
	}
}
