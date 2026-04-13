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

// the pluggable interface — any harness implements this
export type AgentExecutor = (config: AgentConfig) => Effect.Effect<AgentResult>;

// CLI executor — spawns a CLI process (claude, hermes, or any command)
export function createCliExecutor(command: string): AgentExecutor {
	return (config) => {
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

		return Effect.tryPromise({
			try: async () => {
				const proc = Bun.spawn([command, ...args], {
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
	};
}

// default executor — uses claude CLI
export const defaultExecutor: AgentExecutor = createCliExecutor("claude");

// keep buildClaudeArgs and runAgent for backward compat in tests
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

export function runAgent(config: {
	command: string;
	args: string[];
	mode: "print" | "interactive";
	cwd?: string;
}): Effect.Effect<AgentResult> {
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
