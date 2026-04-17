import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as p from "@clack/prompts";
import { generateConventions } from "./conventions";

export interface InitResult {
	success: boolean;
	message: string;
	created: string[];
}

const API_CATALOG = [
	{
		value: "openrouteservice",
		label: "OpenRouteService",
		hint: "routing / drive-time matrix",
		envKey: "OPENROUTESERVICE_API_KEY",
	},
	{
		value: "here",
		label: "HERE",
		hint: "traffic-aware routing",
		envKey: "HERE_API_KEY",
	},
	{
		value: "foursquare",
		label: "Foursquare",
		hint: "places / POIs / dining",
		envKey: "FOURSQUARE_API_KEY",
	},
] as const;

function resolveDirs(visibility: "inline" | "nested") {
	return visibility === "inline"
		? { topicsDir: "./topics", toolsDir: "./tools", base: "." }
		: {
				topicsDir: "./.tala/topics",
				toolsDir: "./.tala/tools",
				base: "./.tala",
			};
}

function buildEnvExample(selectedApis: readonly string[]): string {
	const lines = ["# tala — environment keys", ""];
	const selected = API_CATALOG.filter((a) => selectedApis.includes(a.value));
	for (const api of selected) {
		lines.push(`# ${api.label} — ${api.hint}`);
		lines.push(`${api.envKey}=`);
		lines.push("");
	}
	lines.push("# Add new keys here as your tools need them.");
	return `${lines.join("\n")}\n`;
}

function buildGitignoreEntries(
	visibility: "inline" | "nested",
	trackResearch: boolean,
): string[] {
	const entries = [".env", ".env.local", ".env.*.local", ".cache/"];
	if (!trackResearch) {
		if (visibility === "inline") {
			entries.push("topics/", "tools/");
		} else {
			entries.push(".tala/topics/", ".tala/tools/");
		}
	}
	return entries;
}

async function mergeGitignore(
	cwd: string,
	newEntries: string[],
): Promise<string> {
	const path = join(cwd, ".gitignore");
	const existing = existsSync(path) ? await readFile(path, "utf8") : "";
	const existingLines = new Set(
		existing
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean),
	);
	const toAdd = newEntries.filter((e) => !existingLines.has(e));
	if (toAdd.length === 0) return existing;
	const header = "\n# tala\n";
	const body = toAdd.join("\n");
	return `${existing.trimEnd()}\n${header}${body}\n`;
}

function buildAgentsMd(): string {
	return `# Agent Instructions

This project uses [\`tala\`](https://github.com/MrNiceRicee/tala) — a claim-grounded research lab.

Before editing any topic file, read the conventions below. They encode the discipline that keeps research outputs trustworthy.

---

${generateConventions()}
`;
}

interface WizardAnswers {
	visibility: "inline" | "nested";
	trackResearch: boolean;
	apis: string[];
	writeAgentsMd: boolean;
}

async function prompt(): Promise<WizardAnswers | null> {
	p.intro("tala init");

	const answers = await p.group(
		{
			visibility: () =>
				p.select({
					message: "Where should topics and tools live?",
					options: [
						{
							value: "inline",
							label: "Inline",
							hint: "./topics/, ./tools/ — visible at repo root (recommended for research-first repos)",
						},
						{
							value: "nested",
							label: "Nested",
							hint: "./.tala/topics/, ./.tala/tools/ — keep repo root clean",
						},
					],
					initialValue: "inline",
				}),
			trackResearch: () =>
				p.confirm({
					message: "Track research files in git?",
					initialValue: true,
				}),
			apis: () =>
				p.multiselect({
					message:
						"Which APIs will your tools use? (space to select, enter to confirm)",
					options: API_CATALOG.map((a) => ({
						value: a.value,
						label: a.label,
						hint: a.hint,
					})),
					required: false,
				}),
			writeAgentsMd: () =>
				p.confirm({
					message: "Generate AGENTS.md with claim-marker conventions?",
					initialValue: true,
				}),
		},
		{
			onCancel: () => {
				p.cancel("init cancelled");
				return undefined;
			},
		},
	);

	if (
		!answers ||
		answers.visibility === undefined ||
		answers.trackResearch === undefined
	) {
		return null;
	}

	const visibility = answers.visibility === "nested" ? "nested" : "inline";
	return {
		visibility,
		trackResearch: answers.trackResearch,
		apis: Array.isArray(answers.apis) ? (answers.apis as string[]) : [],
		writeAgentsMd: answers.writeAgentsMd === true,
	};
}

export async function runInit(cwd: string): Promise<InitResult> {
	const configPath = join(cwd, ".tala", "config.json");
	if (existsSync(configPath)) {
		return {
			success: false,
			message: `already initialized — .tala/config.json exists at ${configPath}`,
			created: [],
		};
	}

	const answers = await prompt();
	if (!answers) {
		return { success: false, message: "cancelled", created: [] };
	}

	const { topicsDir, toolsDir } = resolveDirs(answers.visibility);
	const created: string[] = [];

	const spinner = p.spinner();
	spinner.start("writing files");

	// .tala/config.json
	await mkdir(join(cwd, ".tala"), { recursive: true });
	const config = {
		topicsDir,
		toolsDir,
		cacheDir: "./.cache",
		apis: answers.apis,
	};
	await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
	created.push(".tala/config.json");

	// topics + tools directories
	const topicsFullPath = join(cwd, topicsDir);
	const toolsFullPath = join(cwd, toolsDir);
	await mkdir(topicsFullPath, { recursive: true });
	await mkdir(toolsFullPath, { recursive: true });
	await writeFile(join(topicsFullPath, ".gitkeep"), "");
	await writeFile(join(toolsFullPath, ".gitkeep"), "");
	created.push(`${topicsDir}/`, `${toolsDir}/`);

	// .env.example
	const envExample = buildEnvExample(answers.apis);
	await writeFile(join(cwd, ".env.example"), envExample);
	created.push(".env.example");

	// .gitignore (merge with existing)
	const gitignoreEntries = buildGitignoreEntries(
		answers.visibility,
		answers.trackResearch,
	);
	const mergedGitignore = await mergeGitignore(cwd, gitignoreEntries);
	await writeFile(join(cwd, ".gitignore"), mergedGitignore);
	created.push(".gitignore");

	// AGENTS.md (optional)
	if (answers.writeAgentsMd) {
		await writeFile(join(cwd, "AGENTS.md"), buildAgentsMd());
		created.push("AGENTS.md");
	}

	spinner.stop("files written");

	p.outro(
		[
			"tala is ready.",
			"",
			"next:",
			`  tala new "your first topic"`,
			"  tala validate",
			"",
			answers.apis.length > 0
				? "  → fill in .env with your API keys (see .env.example)"
				: "",
		]
			.filter(Boolean)
			.join("\n"),
	);

	return {
		success: true,
		message: `initialized — ${answers.visibility} layout, ${answers.trackResearch ? "tracked" : "ignored"} in git`,
		created,
	};
}
