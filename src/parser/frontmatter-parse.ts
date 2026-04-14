import matter from "gray-matter";

export interface ParsedNote {
	data: Record<string, unknown>;
	content: string;
}

export type ParseResult =
	| { readonly ok: true; readonly value: ParsedNote }
	| { readonly ok: false; readonly error: string };

export function parseMatter(
	raw: string,
):
	| { ok: true; data: Record<string, unknown>; content: string }
	| { ok: false; error: string } {
	try {
		const { data, content } = matter(raw);
		return { ok: true, data: data as Record<string, unknown>, content };
	} catch (e) {
		return { ok: false, error: `parse error: ${String(e)}` };
	}
}

export function normalizeDates(
	data: Record<string, unknown>,
): Record<string, unknown> {
	const normalized = { ...data };
	for (const [key, value] of Object.entries(normalized)) {
		if (value instanceof Date) {
			normalized[key] = value.toISOString().split("T")[0];
		}
	}
	return normalized;
}

export async function readFileSafe(
	filePath: string,
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
	try {
		const file = Bun.file(filePath);
		const exists = await file.exists();
		if (!exists) {
			return { ok: false, error: `file not found: ${filePath}` };
		}
		const content = await file.text();
		return { ok: true, content };
	} catch (e) {
		return { ok: false, error: `read error: ${String(e)}` };
	}
}
