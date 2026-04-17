import { Effect } from "effect";

export interface AgentConfig {
	systemPrompt: string;
	input: string;
	mode: "print" | "interactive";
	cwd?: string;
	visible?: boolean;
}

export interface AgentResult {
	output: string;
	stderr: string;
	exitCode: number;
}

function buildArgs(
	mode: "print" | "interactive",
	systemPrompt?: string,
	input?: string,
): string[] {
	return (
		[
			mode === "print" && "-p",
			systemPrompt && "--append-system-prompt",
			systemPrompt,
			input && mode === "print" && input,
		] satisfies (string | false | undefined)[]
	).filter((x): x is string => typeof x === "string");
}

async function spawnAndCollect(
	command: string,
	args: string[],
	cwd?: string,
): Promise<AgentResult> {
	const proc = Bun.spawn([command, ...args], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { output: stdout, stderr, exitCode };
}

// CLI executor — spawns a CLI process (claude, hermes, or any command)
export function createCliExecutor(command: string) {
	return (config: AgentConfig) =>
		Effect.tryPromise({
			try: () =>
				spawnAndCollect(
					command,
					buildArgs(config.mode, config.systemPrompt, config.input),
					config.cwd,
				),
			catch: (error) => new Error(`agent spawn failed: ${String(error)}`),
		});
}

// the pluggable interface — any harness implements this
// inferred from createCliExecutor to stay annotation-free
export type AgentExecutor = ReturnType<typeof createCliExecutor>;

// default executor — uses claude CLI
export const defaultExecutor: AgentExecutor = createCliExecutor("claude");

// keep buildClaudeArgs and runAgent for backward compat in tests
export function buildClaudeArgs(config: {
	mode: "print" | "interactive";
	systemPrompt?: string;
	input?: string;
}): string[] {
	return buildArgs(config.mode, config.systemPrompt, config.input);
}

export function runAgent(config: {
	command: string;
	args: string[];
	mode: "print" | "interactive";
	cwd?: string;
}) {
	const program = Effect.tryPromise({
		try: () => spawnAndCollect(config.command, config.args, config.cwd),
		catch: (error) => new Error(`agent spawn failed: ${String(error)}`),
	});
	return program;
}
