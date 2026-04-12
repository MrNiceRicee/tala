import { Schema } from "effect";

export const NoteStatus = Schema.Literal("sketch", "working", "distilled");
export type NoteStatus = typeof NoteStatus.Type;

export const NoteType = Schema.Literal("hub", "source", "note", "computation");
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

export const CLAIM_MARKERS = {
	unsupported: {
		label: "unsupported",
		description: "no evidence at all",
	},
	"single-source": {
		label: "single-source",
		description: "one source, needs corroboration",
	},
	hypothesis: {
		label: "hypothesis",
		description: "reasoned inference, not directly provable",
	},
	contradicted: {
		label: "contradicted",
		description: "sources disagree on this claim",
	},
} as const satisfies Record<string, { label: string; description: string }>

export const CLAIM_MARKER_LABELS = Object.values(CLAIM_MARKERS).map(
	(m) => m.label,
) as [string, ...string[]]

export const ClaimMarkerKind = Schema.Literal(...CLAIM_MARKER_LABELS)
export type ClaimMarkerKind = typeof ClaimMarkerKind.Type
