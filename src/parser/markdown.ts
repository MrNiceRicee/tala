export interface Wikilink {
	target: string
	display?: string
	lineNumber: number
}

export interface ClaimMarker {
	kind: "hypothesis" | "unverified"
	line: string
	lineNumber: number
}

export interface MarkdownResult {
	wikilinks: Wikilink[]
	claimMarkers: ClaimMarker[]
	sections: Map<string, string>
}

const wikilinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

export function extractWikilinks(content: string): Wikilink[] {
	const links: Wikilink[] = []
	const lines = content.split("\n")

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		wikilinkPattern.lastIndex = 0
		let match: RegExpExecArray | null = null
		while ((match = wikilinkPattern.exec(line)) !== null) {
			links.push({
				target: match[1].trim(),
				display: match[2]?.trim(),
				lineNumber: i + 1,
			})
		}
	}

	return links
}

const inlineMarkerPattern = /\*\((hypothesis|unverified)\)\*/g

export function extractClaimMarkers(content: string): ClaimMarker[] {
	const markers: ClaimMarker[] = []
	const lines = content.split("\n")

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		inlineMarkerPattern.lastIndex = 0
		let match: RegExpExecArray | null = null
		while ((match = inlineMarkerPattern.exec(line)) !== null) {
			markers.push({
				kind: match[1] as "hypothesis" | "unverified",
				line: line.trim(),
				lineNumber: i + 1,
			})
		}

		const calloutMatch = line.match(/^>\s*\[!(hypothesis|unverified)\]/)
		if (calloutMatch) {
			markers.push({
				kind: calloutMatch[1] as "hypothesis" | "unverified",
				line: line.trim(),
				lineNumber: i + 1,
			})
		}
	}

	return markers
}

export function extractSections(content: string): Map<string, string> {
	const sections = new Map<string, string>()
	const lines = content.split("\n")
	let currentSection: string | null = null
	let currentContent: string[] = []

	for (const line of lines) {
		const headingMatch = line.match(/^## (.+)$/)
		if (headingMatch) {
			if (currentSection) {
				sections.set(currentSection, currentContent.join("\n").trim())
			}
			currentSection = headingMatch[1].trim()
			currentContent = []
		} else if (currentSection) {
			currentContent.push(line)
		}
	}

	if (currentSection) {
		sections.set(currentSection, currentContent.join("\n").trim())
	}

	return sections
}

export function parseMarkdown(content: string): MarkdownResult {
	return {
		wikilinks: extractWikilinks(content),
		claimMarkers: extractClaimMarkers(content),
		sections: extractSections(content),
	}
}
