import { join } from "node:path";
import { runCheck } from "./commands/check";
import { runComputation } from "./commands/compute";
import { generateConventions } from "./commands/conventions";
import { runGather } from "./commands/gather";
import { runHelp } from "./commands/help";
import { refreshIndex } from "./commands/index";
import { createTopic } from "./commands/new";
import { search } from "./commands/search";
import { runValidation } from "./commands/validate";
import { runVerify } from "./commands/verify";

const args = process.argv.slice(2);
const command = args[0];

const commandDescriptions: Record<string, string> = {
	new: "create a new research topic",
	index: "regenerate the topics index",
	validate: "validate repo structure and content",
	search: "search across topics",
	check: "show staleness report",
	compute: "run a deterministic computation script",
	gather: "collect sources for a topic",
	verify: "check and corroborate claims",
	conventions: "regenerate CONVENTIONS.md from definitions",
	help: "show conventions and usage",
};

function printHelp() {
	console.log("research lab cli\n");
	console.log("usage: bun run lab <command> [options]\n");
	console.log("commands:");
	for (const [name, desc] of Object.entries(commandDescriptions)) {
		console.log(`  ${name.padEnd(12)} ${desc}`);
	}
}

if (!command || command === "--help" || command === "-h") {
	printHelp();
	process.exit(0);
}

if (!commandDescriptions[command]) {
	console.error(`unknown command: ${command}`);
	printHelp();
	process.exit(1);
}

const labRoot = import.meta.dir.replace(/\/src$/, "");

switch (command) {
	case "new": {
		const title = args.slice(1).join(" ");
		if (!title) {
			console.error('usage: bun run lab new "Topic Title"');
			process.exit(1);
		}
		const result = await createTopic(labRoot, title);
		if (result.success) {
			console.log(`created topic: ${result.slug}`);
			console.log(`  ${result.path}`);
		} else {
			console.error(result.error);
			process.exit(1);
		}
		break;
	}
	case "index": {
		const result = await refreshIndex(labRoot);
		console.log(`index refreshed: ${result.topicCount} topic(s)`);
		break;
	}
	case "validate": {
		const slug = args[1];
		const result = await runValidation(labRoot, slug);
		if (result.report) {
			console.log(result.report);
		}
		if (result.totalIssues === 0) {
			console.log("no issues found");
		} else {
			console.log(`${result.totalIssues} issue(s) found`);
		}
		process.exit(result.exitCode);
		break;
	}
	case "compute": {
		const slug = args[1];
		const scriptName = args[2];
		if (!slug || !scriptName) {
			console.error(
				"usage: bun run lab compute <topic-slug> <script-name> [-- args...]",
			);
			process.exit(1);
		}
		const dashDash = args.indexOf("--");
		const scriptArgs = dashDash >= 0 ? args.slice(dashDash + 1) : [];

		const result = await runComputation(labRoot, slug, scriptName, scriptArgs);
		if (result.success) {
			console.log(result.output);
			console.log(`output saved: ${result.outputPath}`);
		} else {
			console.error(result.error);
			process.exit(1);
		}
		break;
	}
	case "search": {
		const query = args.slice(1).join(" ");
		if (!query) {
			console.error('usage: bun run lab search "query"');
			process.exit(1);
		}
		const hits = await search(labRoot, query);
		if (hits.length === 0) {
			console.log("no results found");
		} else {
			for (const hit of hits) {
				console.log(`[${hit.status}] ${hit.file}:${hit.line}`);
				console.log(`  ${hit.context}`);
			}
			console.log(`\n${hits.length} result(s)`);
		}
		break;
	}

	case "check": {
		const result = await runCheck(labRoot);
		if (result.report) {
			console.log(result.report);
		}
		if (result.issueCount === 0) {
			console.log("nothing needs attention");
		} else {
			console.log(`${result.issueCount} item(s) need attention`);
		}
		break;
	}

	case "gather": {
		const slug = args[1];
		if (!slug) {
			console.error(
				"usage: bun run lab gather <topic-slug> [--rounds N] [--visible]",
			);
			process.exit(1);
		}
		const roundsIdx = args.indexOf("--rounds");
		const rounds = roundsIdx >= 0 ? parseInt(args[roundsIdx + 1], 10) || 1 : 1;
		const visible = args.includes("--visible");
		const result = await runGather(labRoot, slug, { rounds, visible });
		console.log(
			`gather complete: ${result.sourcesAdded} source(s) added in ${result.roundsCompleted} round(s)`,
		);
		break;
	}

	case "verify": {
		const slug = args[1];
		if (!slug) {
			console.error(
				"usage: bun run lab verify <topic-slug> [--rounds N] [--visible]",
			);
			process.exit(1);
		}
		const roundsIdx = args.indexOf("--rounds");
		const rounds = roundsIdx >= 0 ? parseInt(args[roundsIdx + 1], 10) || 1 : 1;
		const visible = args.includes("--visible");
		const result = await runVerify(labRoot, slug, { rounds, visible });
		console.log(
			`verify complete: ${result.claimsChecked} checked, ${result.markersChanged} changed in ${result.roundsCompleted} round(s)`,
		);
		break;
	}

	case "conventions": {
		const content = generateConventions();
		const conventionsPath = join(labRoot, "CONVENTIONS.md");
		await Bun.write(conventionsPath, content);
		console.log("CONVENTIONS.md regenerated from TypeScript definitions");
		break;
	}

	case "help": {
		const topic = args[1];
		console.log(runHelp(topic));
		break;
	}

	default:
		console.log(`[lab] command "${command}" not yet implemented`);
}
