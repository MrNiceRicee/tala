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
