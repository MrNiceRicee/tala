import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { getRegisteredTool, runToolInProcess } from "../tool-runner";

// Runtime-resolved tool load. Tools live at `<labRoot>/tools/<name>.ts` -
// a path only known at call time, so static ESM `import "..."` won't work.
// `createRequire` resolves CommonJS-style from this module's URL; Bun's loader
// compiles the .ts file and runs the top-level `defineTool(…)` call as a
// side effect, which is what populates the registry.
const requireTool = createRequire(import.meta.url);

export interface ToolResult {
	success: boolean;
	output: string;
	outputPath?: string;
	error?: string;
}

function today(): string {
	return new Date().toISOString().split("T")[0];
}

function generateToolOutput(
	title: string,
	toolName: string,
	args: string[],
	output: string,
): string {
	const date = today();
	const argsLine =
		args.length > 0 ? `\nargs: [${args.map((a) => `"${a}"`).join(", ")}]` : "";

	return `---
type: computation
title: ${title}
tool: ${toolName}
tool_path: ../../../tools/${toolName}.ts${argsLine}
ran_at: ${date}
status: distilled
created: ${date}
updated: ${date}
---

# ${title}

${output.trim()}
`;
}

export async function runTool(
	labRoot: string,
	slug: string,
	toolName: string,
	args: string[],
): Promise<ToolResult> {
	const toolPath = join(labRoot, "tools", `${toolName}.ts`);
	const topicDir = join(labRoot, "topics", slug);

	if (!existsSync(toolPath)) {
		return { success: false, output: "", error: `tool not found: ${toolPath}` };
	}

	if (!existsSync(topicDir)) {
		return {
			success: false,
			output: "",
			error: `topic not found: ${topicDir}`,
		};
	}

	try {
		// Side-effect load - running `defineTool(…, import.meta)` at module
		// top level is what registers the tool. import.meta.main is false
		// because this loader isn't the entry point, so runMain stays off.
		requireTool(toolPath);

		const def = getRegisteredTool(toolName);
		if (!def) {
			return {
				success: false,
				output: "",
				error: `tool "${toolName}" did not register via defineTool`,
			};
		}

		// Tools resolve relative paths (e.g., "computations/points.json") via
		// the WorkingDir FiberRef set inside runToolInProcess - no chdir.
		const output = await runToolInProcess(def, args, topicDir);

		const computationsDir = join(topicDir, "computations");
		const outputPath = join(computationsDir, `${toolName}.output.md`);
		const title = toolName
			.replace(/[-_]/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
		const content = generateToolOutput(title, toolName, args, output);
		await Bun.write(outputPath, content);

		return { success: true, output, outputPath };
	} catch (e) {
		return {
			success: false,
			output: "",
			error: `run error: ${e instanceof Error ? e.message : String(e)}`,
		};
	}
}

export async function listTools(labRoot: string): Promise<string[]> {
	const toolsDir = join(labRoot, "tools");

	if (!existsSync(toolsDir)) {
		return [];
	}

	const files = await readdir(toolsDir);
	return files
		.filter((f) => f.endsWith(".ts"))
		.map((f) => f.replace(/\.ts$/, ""))
		.sort();
}
