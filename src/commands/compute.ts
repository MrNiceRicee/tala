import { existsSync } from "node:fs";
import { join } from "node:path";

export interface ComputeResult {
	success: boolean;
	output: string;
	outputPath?: string;
	error?: string;
}

function today(): string {
	return new Date().toISOString().split("T")[0];
}

function generateOutput(
	title: string,
	scriptName: string,
	args: string[],
	output: string,
): string {
	const date = today();
	const argsLine =
		args.length > 0 ? `\nargs: [${args.map((a) => `"${a}"`).join(", ")}]` : "";

	return `---
type: computation
title: ${title}
script: ./${scriptName}${argsLine}
ran_at: ${date}
status: distilled
created: ${date}
updated: ${date}
---

# ${title}

${output.trim()}
`;
}

export async function runComputation(
	labRoot: string,
	slug: string,
	scriptName: string,
	args: string[],
): Promise<ComputeResult> {
	const computationsDir = join(labRoot, "topics", slug, "computations");
	const scriptPath = join(computationsDir, scriptName);

	if (!existsSync(scriptPath)) {
		return {
			success: false,
			output: "",
			error: `script not found: ${scriptPath}`,
		};
	}

	try {
		const proc = Bun.spawn(["bun", scriptPath, ...args], {
			cwd: computationsDir,
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
				error: `script exited with code ${exitCode}: ${stderr}`,
			};
		}

		const baseName = scriptName.replace(/\.[^.]+$/, "");
		const outputPath = join(computationsDir, `${baseName}.output.md`);
		const title = baseName
			.replace(/[-_]/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase());
		const content = generateOutput(title, scriptName, args, stdout);
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
