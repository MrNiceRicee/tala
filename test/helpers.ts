import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function createTempLab(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "lab-test-"));
	const topicsDir = join(dir, "topics");
	await Bun.write(
		join(topicsDir, "index.md"),
		"---\ntype: index\ntitle: Topics Index\n---\n",
	);
	return dir;
}

export async function cleanupTempLab(dir: string): Promise<void> {
	await rm(dir, { recursive: true, force: true });
}
