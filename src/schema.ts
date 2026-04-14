import { Schema } from "effect";

export const NoteStatus = Schema.Literals(["sketch", "working", "distilled"]);
export type NoteStatus = typeof NoteStatus.Type;

export const NoteType = Schema.Literals([
	"hub",
	"source",
	"note",
	"computation",
]);
export type NoteType = typeof NoteType.Type;

export const BaseFrontmatter = Schema.Struct({
	type: NoteType,
	title: Schema.String,
	status: NoteStatus,
	created: Schema.String,
	updated: Schema.String,
});
export type BaseFrontmatter = typeof BaseFrontmatter.Type;

export const HubFrontmatter = Schema.Struct({
	...BaseFrontmatter.fields,
	slug: Schema.optional(Schema.String),
	tags: Schema.optional(Schema.Array(Schema.String)),
	aliases: Schema.optional(Schema.Array(Schema.String)),
});
export type HubFrontmatter = typeof HubFrontmatter.Type;

export const SourceFrontmatter = Schema.Struct({
	...BaseFrontmatter.fields,
	url: Schema.optional(Schema.String),
	author: Schema.optional(Schema.String),
	accessed: Schema.optional(Schema.String),
});
export type SourceFrontmatter = typeof SourceFrontmatter.Type;

export const NoteFrontmatter = Schema.Struct({
	...BaseFrontmatter.fields,
	tags: Schema.optional(Schema.Array(Schema.String)),
	aliases: Schema.optional(Schema.Array(Schema.String)),
});
export type NoteFrontmatter = typeof NoteFrontmatter.Type;

export const ComputationFrontmatter = Schema.Struct({
	...BaseFrontmatter.fields,
	script: Schema.optional(Schema.String),
	ran_at: Schema.optional(Schema.String),
});
export type ComputationFrontmatter = typeof ComputationFrontmatter.Type;

type MarkerLabel = "unsupported" | "single-source" | "hypothesis" | "contradicted";
const MARKER_LABELS: readonly [
	MarkerLabel,
	MarkerLabel,
	MarkerLabel,
	MarkerLabel,
] = ["unsupported", "single-source", "hypothesis", "contradicted"];

export const CLAIM_MARKERS = {
	unsupported: {
		label: MARKER_LABELS[0],
		description: "no evidence at all",
	},
	"single-source": {
		label: MARKER_LABELS[1],
		description: "one source, needs corroboration",
	},
	hypothesis: {
		label: MARKER_LABELS[2],
		description: "reasoned inference, not directly provable",
	},
	contradicted: {
		label: MARKER_LABELS[3],
		description: "sources disagree on this claim",
	},
} as const satisfies Record<string, { label: string; description: string }>;

export const CLAIM_MARKER_LABELS = MARKER_LABELS;
export const ClaimMarkerKind = Schema.Literals(MARKER_LABELS);
export type ClaimMarkerKind = typeof ClaimMarkerKind.Type;

export type SeverityLevel = "error" | "warn" | "info" | "ignore";

export const MARKER_SEVERITY: Record<string, Record<string, SeverityLevel>> = {
	unsupported: { sketch: "ignore", working: "warn", distilled: "error" },
	"single-source": { sketch: "ignore", working: "info", distilled: "warn" },
	hypothesis: { sketch: "ignore", working: "ignore", distilled: "ignore" },
	contradicted: { sketch: "ignore", working: "warn", distilled: "error" },
	"bare-claim": { sketch: "ignore", working: "warn", distilled: "error" },
};
