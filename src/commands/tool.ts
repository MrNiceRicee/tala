import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

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

	const computationsDir = join(topicDir, "computations");

	try {
		const proc = Bun.spawn(["bun", toolPath, ...args], {
			cwd: topicDir,
			stdout: "pipe",
			stderr: "pipe",
		});

		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		if (exitCode !== 0) {
			return {
				success: false,
				output: stdout,
				error: `tool exited with code ${exitCode}: ${stderr}`,
			};
		}

		const outputPath = join(computationsDir, `${toolName}.output.md`);
		const title = toolName
			.replace(/[-_]/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
		const content = generateToolOutput(title, toolName, args, stdout);
		await Bun.write(outputPath, content);

		return { success: true, output: stdout, outputPath };
	} catch (e) {
		return {
			success: false,
			output: "",
			error: `run error: ${String(e)}`,
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
