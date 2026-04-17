import { join } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Data, Effect, Match, Runtime, Stdio } from "effect";
import { runCheck } from "./commands/check";
import { runComputation } from "./commands/compute";
import { generateConventions } from "./commands/conventions";
import { prepareGather } from "./commands/gather";
import { runHelp } from "./commands/help";
import { refreshIndex } from "./commands/index";
import { createTopic } from "./commands/new";
import { applyRefine, prepareRefine } from "./commands/refine";
import { search } from "./commands/search";
import { listTools, runTool } from "./commands/tool";
import { runValidation } from "./commands/validate";
import { prepareVerify } from "./commands/verify";

class CliError extends Data.TaggedError("CliError")<{
	readonly message: string;
	readonly exitCode: number;
}> {
	readonly [Runtime.errorExitCode] = this.exitCode;
}

// labRoot is the user's current working directory — where they invoked
// `tala` from. Topics, tools, .tala/config.json, .env, .cache all resolve
// relative to here. Falls back to "." if PWD is unset (unlikely in Bun).
const labRoot = Bun.env.PWD ?? ".";

const commandDescriptions: Record<string, string> = {
	new: "create a new research topic",
	index: "regenerate the topics index",
	validate: "validate repo structure and content",
	search: "search across topics",
	check: "show staleness report",
	compute: "run a deterministic computation script",
	gather: "output gather context for a topic",
	verify: "check claims and output corroboration context",
	conventions: "regenerate CONVENTIONS.md from definitions",
	help: "show conventions and usage",
	refine: "tournament-refine a topic section",
	tool: "run a reusable tool from tools/ on a topic",
	tools: "list available tools",
};

const helpLines = [
	"research lab cli\n",
	"usage: bun run lab <command> [options]\n",
	"commands:",
	...Object.entries(commandDescriptions).map(
		([name, desc]) => `  ${name.padEnd(12)} ${desc}`,
	),
];

const printHelp = Effect.forEach(helpLines, (line) => Console.log(line), {
	discard: true,
});

const exit1 = Effect.fail(new CliError({ message: "", exitCode: 1 }));

function argsAfterDashDash(args: readonly string[]): string[] {
	const idx = args.indexOf("--");
	return Match.value(idx >= 0).pipe(
		Match.when(true, () => args.slice(idx + 1)),
		Match.orElse(() => [] as string[]),
	);
}

function sectionFromArgs(args: readonly string[]): string {
	const sectionIdx = args.indexOf("--section");
	return Match.value(sectionIdx >= 0).pipe(
		Match.when(true, () => args[sectionIdx + 1] ?? "Findings"),
		Match.orElse(() => "Findings"),
	);
}

function toolsOutput(tools: string[]): string {
	return Match.value(tools.length === 0).pipe(
		Match.when(
			true,
			() => "no tools available. drop .ts files into tools/ to get started.",
		),
		Match.orElse(() =>
			["available tools:", "", ...tools.map((t) => `  ${t}`)].join("\n"),
		),
	);
}

const usageNew = Console.error('usage: bun run lab new "Topic Title"').pipe(
	Effect.andThen(exit1),
);

const usageCompute = Console.error(
	"usage: bun run lab compute <topic-slug> <script-name> [-- args...]",
).pipe(Effect.andThen(exit1));

const usageSearch = Console.error('usage: bun run lab search "query"').pipe(
	Effect.andThen(exit1),
);

const usageGather = Console.error(
	"usage: bun run lab gather <topic-slug>",
).pipe(Effect.andThen(exit1));

const usageVerify = Console.error(
	"usage: bun run lab verify <topic-slug>",
).pipe(Effect.andThen(exit1));

const usageTool = Console.error(
	"usage: bun run lab tool <topic-slug> <tool-name> [-- args...]",
).pipe(Effect.andThen(exit1));

const usageRefineApply = Console.error(
	"usage: bun run lab refine apply <topic-slug> --section Findings",
).pipe(Effect.andThen(exit1));

const usageRefinePrepare = Console.error(
	"usage: bun run lab refine <topic-slug> [--section Findings]",
).pipe(
	Effect.andThen(
		Console.error(
			"       bun run lab refine apply <topic-slug> --section Findings",
		),
	),
	Effect.andThen(exit1),
);

const refineApplyEffect = Effect.gen(function* () {
	const argv = yield* Stdio.Stdio.use((s) => s.args);
	const args = argv;
	const applySlug = args[2];
	const section = sectionFromArgs(args);
	const noSlug = Effect.succeed(!applySlug);
	yield* usageRefineApply.pipe(Effect.when(noSlug));
	const input = yield* Effect.promise(() => Bun.stdin.text());
	yield* Effect.promise(() => applyRefine(labRoot, applySlug, section, input));
	yield* Console.log(`refined section written to ${applySlug}`);
});

const refinePrepareEffect = Effect.gen(function* () {
	const argv = yield* Stdio.Stdio.use((s) => s.args);
	const args = argv;
	const slug = args[1];
	const section = sectionFromArgs(args);
	const noSlug = Effect.succeed(!slug);
	yield* usageRefinePrepare.pipe(Effect.when(noSlug));
	const output = yield* Effect.promise(() =>
		prepareRefine(labRoot, slug, section),
	);
	yield* Console.log(output);
});

const dispatchEffect = Effect.gen(function* () {
	const argv = yield* Stdio.Stdio.use((s) => s.args);
	const args = argv;
	const command = args[0];

	const isUnknown = Effect.succeed(!commandDescriptions[command]);
	yield* Console.error(`unknown command: ${command}`).pipe(
		Effect.andThen(printHelp),
		Effect.andThen(exit1),
		Effect.when(isUnknown),
	);

	switch (command) {
		case "new": {
			const title = args.slice(1).join(" ");
			const noTitle = Effect.succeed(!title);
			yield* usageNew.pipe(Effect.when(noTitle));
			const result = yield* Effect.promise(() => createTopic(labRoot, title));
			const success = Effect.succeed(result.success);
			const notSuccess = Effect.succeed(!result.success);
			yield* Console.log(`created topic: ${result.slug}`).pipe(
				Effect.andThen(Console.log(`  ${result.path}`)),
				Effect.when(success),
			);
			yield* Console.error(result.error ?? "").pipe(
				Effect.andThen(exit1),
				Effect.when(notSuccess),
			);
			break;
		}

		case "index": {
			const result = yield* Effect.promise(() => refreshIndex(labRoot));
			yield* Console.log(`index refreshed: ${result.topicCount} topic(s)`);
			break;
		}

		case "validate": {
			const slug = args[1];
			const result = yield* Effect.promise(() => runValidation(labRoot, slug));
			const hasReport = Effect.succeed(result.report.length > 0);
			yield* Console.log(result.report).pipe(Effect.when(hasReport));
			const noIssues = Effect.succeed(result.totalIssues === 0);
			yield* Console.log("no issues found").pipe(Effect.when(noIssues));
			const hasIssues = Effect.succeed(result.totalIssues > 0);
			yield* Console.log(`${result.totalIssues} issue(s) found`).pipe(
				Effect.when(hasIssues),
			);
			const shouldFail = Effect.succeed(result.exitCode !== 0);
			const failWithCode = Effect.fail(
				new CliError({ message: "", exitCode: result.exitCode }),
			);
			yield* failWithCode.pipe(Effect.when(shouldFail));
			break;
		}

		case "compute": {
			const slug = args[1];
			const scriptName = args[2];
			const noArgs = Effect.succeed(!slug || !scriptName);
			yield* usageCompute.pipe(Effect.when(noArgs));
			const scriptArgs = argsAfterDashDash(args);
			const result = yield* Effect.promise(() =>
				runComputation(labRoot, slug, scriptName, scriptArgs),
			);
			const success = Effect.succeed(result.success);
			const notSuccess = Effect.succeed(!result.success);
			yield* Console.log(result.output).pipe(
				Effect.andThen(Console.log(`output saved: ${result.outputPath}`)),
				Effect.when(success),
			);
			yield* Console.error(result.error ?? "").pipe(
				Effect.andThen(exit1),
				Effect.when(notSuccess),
			);
			break;
		}

		case "search": {
			const query = args.slice(1).join(" ");
			const noQuery = Effect.succeed(!query);
			yield* usageSearch.pipe(Effect.when(noQuery));
			const hits = yield* Effect.promise(() => search(labRoot, query));
			const noHits = Effect.succeed(hits.length === 0);
			yield* Console.log("no results found").pipe(Effect.when(noHits));
			const hasHits = Effect.succeed(hits.length > 0);
			yield* Effect.forEach(
				hits,
				(hit) =>
					Console.log(`[${hit.status}] ${hit.file}:${hit.line}`).pipe(
						Effect.andThen(Console.log(`  ${hit.context}`)),
					),
				{ discard: true },
			).pipe(
				Effect.andThen(Console.log(`\n${hits.length} result(s)`)),
				Effect.when(hasHits),
			);
			break;
		}

		case "check": {
			const result = yield* Effect.promise(() => runCheck(labRoot));
			const hasReport = Effect.succeed(result.report.length > 0);
			yield* Console.log(result.report).pipe(Effect.when(hasReport));
			const noIssues = Effect.succeed(result.issueCount === 0);
			yield* Console.log("nothing needs attention").pipe(Effect.when(noIssues));
			const hasIssues = Effect.succeed(result.issueCount > 0);
			yield* Console.log(`${result.issueCount} item(s) need attention`).pipe(
				Effect.when(hasIssues),
			);
			break;
		}

		case "gather": {
			const slug = args[1];
			const noSlug = Effect.succeed(!slug);
			yield* usageGather.pipe(Effect.when(noSlug));
			const output = yield* Effect.promise(() => prepareGather(labRoot, slug));
			yield* Console.log(output);
			break;
		}

		case "verify": {
			const slug = args[1];
			const noSlug = Effect.succeed(!slug);
			yield* usageVerify.pipe(Effect.when(noSlug));
			const output = yield* Effect.promise(() => prepareVerify(labRoot, slug));
			yield* Console.log(output);
			break;
		}

		case "conventions": {
			const content = generateConventions();
			const conventionsPath = join(labRoot, "CONVENTIONS.md");
			yield* Effect.promise(() => Bun.write(conventionsPath, content));
			yield* Console.log(
				"CONVENTIONS.md regenerated from TypeScript definitions",
			);
			break;
		}

		case "help": {
			const topic = args[1];
			yield* Console.log(runHelp(topic));
			break;
		}

		case "refine": {
			const subcommand = args[1];
			yield* Match.value(subcommand === "apply").pipe(
				Match.when(true, () => refineApplyEffect),
				Match.orElse(() => refinePrepareEffect),
			);
			break;
		}

		case "tool": {
			const slug = args[1];
			const toolName = args[2];
			const noArgs = Effect.succeed(!slug || !toolName);
			yield* usageTool.pipe(Effect.when(noArgs));
			const toolArgs = argsAfterDashDash(args);
			const result = yield* Effect.promise(() =>
				runTool(labRoot, slug, toolName, toolArgs),
			);
			const success = Effect.succeed(result.success);
			const notSuccess = Effect.succeed(!result.success);
			yield* Console.log(result.output).pipe(
				Effect.andThen(Console.log(`output saved: ${result.outputPath}`)),
				Effect.when(success),
			);
			yield* Console.error(result.error ?? "").pipe(
				Effect.andThen(exit1),
				Effect.when(notSuccess),
			);
			break;
		}

		case "tools": {
			const tools = yield* Effect.promise(() => listTools(labRoot));
			yield* Console.log(toolsOutput(tools));
			break;
		}

		default:
			yield* Console.log(`[lab] command "${command}" not yet implemented`);
	}
});

const program = Effect.gen(function* () {
	const argv = yield* Stdio.Stdio.use((s) => s.args);
	const command = argv[0];
	const needsHelp = !command || command === "--help" || command === "-h";
	yield* Match.value(needsHelp).pipe(
		Match.when(true, () => printHelp),
		Match.orElse(() => dispatchEffect),
	);
});

program.pipe(
	Effect.provide(BunServices.layer),
	BunRuntime.runMain({ disableErrorReporting: true }),
);
