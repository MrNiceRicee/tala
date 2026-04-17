// Resource abstraction used by `tala get`.
//
// A resource is any listable/inspectable thing in a tala project - topics,
// tools, and (future) cache entries, configs, schemas. Each resource owns
// its own list/detail/view/serialize logic. `tala get` just dispatches.
//
// Adding a new resource is: one file implementing this interface, one line
// in resources/registry.ts. No CLI surgery, no help-text edits.

export interface ResourceContext {
	labRoot: string;
}

export interface ListFilters {
	status?: string;
}

export interface ResourceView<TDetail> {
	name: string;
	// optional filter shape (view-local flags like --marker on claims view).
	// Keys become CLI flag names.
	filters?: Record<string, string>;
	renderMarkdown: (detail: TDetail, filters: Record<string, string>) => string;
	serialize: (detail: TDetail, filters: Record<string, string>) => unknown;
}

// biome-ignore lint/suspicious/noExplicitAny: registry is heterogeneous across resource types
export interface Resource<TMeta = any, TDetail = any> {
	name: string;
	description: string;

	list: (ctx: ResourceContext, filters: ListFilters) => Promise<TMeta[]>;
	get?: (ctx: ResourceContext, name: string) => Promise<TDetail | null>;

	renderList: (items: TMeta[]) => string;
	renderDetail?: (detail: TDetail, fullMode: boolean) => string;
	serializeList: (items: TMeta[]) => unknown;
	serializeDetail?: (detail: TDetail, fullMode: boolean) => unknown;

	views?: readonly ResourceView<TDetail>[];
}
