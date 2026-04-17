import { cacheResource } from "./cache";
import { configResource } from "./config";
import { schemaResource } from "./schema";
import { toolsResource } from "./tools";
import { topicsResource } from "./topics";
import type { Resource } from "./types";

// Order determines `tala get` root-catalog listing. Add new resources here.
export const RESOURCES: readonly Resource[] = [
	topicsResource,
	toolsResource,
	cacheResource,
	configResource,
	schemaResource,
];

export function findResource(name: string): Resource | undefined {
	return RESOURCES.find((r) => r.name === name);
}
