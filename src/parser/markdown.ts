import { CLAIM_MARKERS, type ClaimMarkerKind } from "../schema";

export interface Wikilink {
	target: string;
	display?: string;
	lineNumber: number;
}

export interface ClaimMarker {
	kind: ClaimMarkerKind;
	line: string;
	lineNumber: number;
}

export interface MarkdownResult {
	wikilinks: Wikilink[];
	claimMarkers: ClaimMarker[];
	sections: Map<string, string>;
}

const wikilinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function extractWikilinks(content: string): Wikilink[] {
	const links: Wikilink[] = [];
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		wikilinkPattern.lastIndex = 0;
		for (
			let match = wikilinkPattern.exec(line);
			match !== null;
			match = wikilinkPattern.exec(line)
		) {
			links.push({
				target: match[1].trim(),
				display: match[2]?.trim(),
				lineNumber: i + 1,
			});
		}
	}

	return links;
}

const markerLabels = Object.values(CLAIM_MARKERS).map((m) => m.label);
const inlineMarkerPattern = new RegExp(
	`\\*\\((${markerLabels.join("|")})\\)\\*`,
	"g",
);
const calloutPattern = new RegExp(`^>\\s*\\[!(${markerLabels.join("|")})\\]`);

export function extractClaimMarkers(content: string): ClaimMarker[] {
	const markers: ClaimMarker[] = [];
	const lines = content.split("\n");
	const validKinds = new Set<string>(markerLabels);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		inlineMarkerPattern.lastIndex = 0;
		for (
			let match = inlineMarkerPattern.exec(line);
			match !== null;
			match = inlineMarkerPattern.exec(line)
		) {
			const kind = match[1];
			if (validKinds.has(kind)) {
				markers.push({
					kind: kind as ClaimMarkerKind,
					line: line.trim(),
					lineNumber: i + 1,
				});
			}
		}

		const calloutMatch = line.match(calloutPattern);
		if (calloutMatch) {
			const kind = calloutMatch[1];
			if (validKinds.has(kind)) {
				markers.push({
					kind: kind as ClaimMarkerKind,
					line: line.trim(),
					lineNumber: i + 1,
				});
			}
		}
	}

	return markers;
}

export function extractSections(content: string): Map<string, string> {
	const sections = new Map<string, string>();
	const lines = content.split("\n");
	let currentSection: string | null = null;
	let currentContent: string[] = [];

	for (const line of lines) {
		const headingMatch = line.match(/^## (.+)$/);
		if (headingMatch) {
			if (currentSection) {
				sections.set(currentSection, currentContent.join("\n").trim());
			}
			currentSection = headingMatch[1].trim();
			currentContent = [];
		} else if (currentSection) {
			currentContent.push(line);
		}
	}

	if (currentSection) {
		sections.set(currentSection, currentContent.join("\n").trim());
	}

	return sections;
}

export function parseMarkdown(content: string): MarkdownResult {
	return {
		wikilinks: extractWikilinks(content),
		claimMarkers: extractClaimMarkers(content),
		sections: extractSections(content),
	};
}
