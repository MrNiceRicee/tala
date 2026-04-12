const args = process.argv.slice(2)
const command = args[0]

const commands: Record<string, string> = {
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
	for (const [name, desc] of Object.entries(commands)) {
		console.log(`  ${name.padEnd(12)} ${desc}`)
	}
}

if (!command || command === "--help" || command === "-h") {
	printHelp()
	process.exit(0)
}

if (!commands[command]) {
	console.error(`unknown command: ${command}`)
	printHelp()
	process.exit(1)
}

console.log(`[lab] command "${command}" not yet implemented`)
