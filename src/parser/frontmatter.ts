import { Schema } from "effect"
import matter from "gray-matter"
import { BaseFrontmatter } from "../schema"

export interface ParsedNote {
	data: Record<string, unknown>
	content: string
}

export type ParseResult =
	| { readonly ok: true; readonly value: ParsedNote }
	| { readonly ok: false; readonly error: string }

export function parseFrontmatter(raw: string): ParseResult {
	try {
		const { data, content } = matter(raw)

		if (!data || Object.keys(data).length === 0) {
			return { ok: false, error: "no frontmatter found" }
		}

		// normalize dates (gray-matter converts YAML dates to Date objects)
		const normalized = { ...data }
		for (const [key, value] of Object.entries(normalized)) {
			if (value instanceof Date) {
				normalized[key] = value.toISOString().split("T")[0]
			}
		}

		try {
			Schema.decodeUnknownSync(BaseFrontmatter)(normalized)
		} catch (e) {
			return { ok: false, error: `invalid frontmatter: ${String(e)}` }
		}

		return { ok: true, value: { data: normalized, content } }
	} catch (e) {
		return { ok: false, error: `parse error: ${String(e)}` }
	}
}

export async function parseFrontmatterFromFile(
	filePath: string,
): Promise<ParseResult> {
	try {
		const file = Bun.file(filePath)
		const exists = await file.exists()
		if (!exists) {
			return { ok: false, error: `file not found: ${filePath}` }
		}
		const raw = await file.text()
		return parseFrontmatter(raw)
	} catch (e) {
		return { ok: false, error: `read error: ${String(e)}` }
	}
}
