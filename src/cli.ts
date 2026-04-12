import { createTopic } from "./commands/new"
import { refreshIndex } from "./commands/index"

const args = process.argv.slice(2)
const command = args[0]

const commandDescriptions: Record<string, string> = {
	new: "create a new research topic",
	index: "regenerate the topics index",
	validate: "validate repo structure and content",
	search: "search across topics",
	check: "show staleness report",
	compute: "run a deterministic computation script",
}

function printHelp() {
	console.log("research lab cli\n")
	console.log("usage: bun run lab <command> [options]\n")
	console.log("commands:")
	for (const [name, desc] of Object.entries(commandDescriptions)) {
		console.log(`  ${name.padEnd(12)} ${desc}`)
	}
}

if (!command || command === "--help" || command === "-h") {
	printHelp()
	process.exit(0)
}

if (!commandDescriptions[command]) {
	console.error(`unknown command: ${command}`)
	printHelp()
	process.exit(1)
}

const labRoot = import.meta.dir.replace(/\/src$/, "")

switch (command) {
	case "new": {
		const title = args.slice(1).join(" ")
		if (!title) {
			console.error("usage: bun run lab new \"Topic Title\"")
			process.exit(1)
		}
		const result = await createTopic(labRoot, title)
		if (result.success) {
			console.log(`created topic: ${result.slug}`)
			console.log(`  ${result.path}`)
		} else {
			console.error(result.error)
			process.exit(1)
		}
		break
	}
	case "index": {
		const result = await refreshIndex(labRoot)
		console.log(`index refreshed: ${result.topicCount} topic(s)`)
		break
	}
	default:
		console.log(`[lab] command "${command}" not yet implemented`)
}
