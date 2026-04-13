import { Effect } from "effect";

export interface AgentConfig {
	command: string;
	args: string[];
	mode: "print" | "interactive";
	cwd?: string;
	visible?: boolean;
}

export interface AgentResult {
	output: string;
	stderr: string;
	exitCode: number;
}

export function buildClaudeArgs(config: {
	mode: "print" | "interactive";
	systemPrompt?: string;
	input?: string;
}): string[] {
	const args: string[] = [];
	if (config.mode === "print") {
		args.push("-p");
	}
	if (config.systemPrompt) {
		args.push("--append-system-prompt", config.systemPrompt);
	}
	if (config.input && config.mode === "print") {
		args.push(config.input);
	}
	return args;
}

export function runAgent(config: AgentConfig): Effect.Effect<AgentResult> {
	return Effect.tryPromise({
		try: async () => {
			const proc = Bun.spawn([config.command, ...config.args], {
				cwd: config.cwd,
				stdout: "pipe",
				stderr: "pipe",
			});
			const stdout = await new Response(proc.stdout).text();
			const stderr = await new Response(proc.stderr).text();
			const exitCode = await proc.exited;
			return { output: stdout, stderr, exitCode };
		},
		catch: (error) => new Error(`agent spawn failed: ${String(error)}`),
	});
}

export function runClaudeAgent(config: {
	mode: "print" | "interactive";
	systemPrompt: string;
	input: string;
	cwd?: string;
	visible?: boolean;
}): Effect.Effect<AgentResult> {
	const args = buildClaudeArgs({
		mode: config.mode,
		systemPrompt: config.systemPrompt,
		input: config.input,
	});
	return runAgent({
		command: "claude",
		args,
		mode: config.mode,
		cwd: config.cwd,
		visible: config.visible,
	});
}
