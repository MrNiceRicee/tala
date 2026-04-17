import { toolsResource } from "./tools";
import { topicsResource } from "./topics";
import type { Resource } from "./types";

// Order determines `tala get` root-catalog listing. Add new resources here.
export const RESOURCES: readonly Resource[] = [topicsResource, toolsResource];

export function findResource(name: string): Resource | undefined {
	return RESOURCES.find((r) => r.name === name);
}
