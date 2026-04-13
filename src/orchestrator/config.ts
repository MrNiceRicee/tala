import { existsSync } from "node:fs";
import { join } from "node:path";
import { Effect, Schema } from "effect";

const LabConfigSchema = Schema.Struct({
	convergenceK: Schema.Number,
	maxPasses: Schema.Number,
	judgeCount: Schema.Number,
	staleAfterDays: Schema.Number,
	warnUnverifiedAfterDays: Schema.Number,
});

export type LabConfig = typeof LabConfigSchema.Type;

export const DEFAULT_CONFIG: LabConfig = {
	convergenceK: 2,
	maxPasses: 10,
	judgeCount: 3,
	staleAfterDays: 60,
	warnUnverifiedAfterDays: 30,
};

export function loadConfig(labRoot: string): Effect.Effect<LabConfig> {
	return Effect.sync(() => {
		const configPath = join(labRoot, "lab.config.ts");
		if (!existsSync(configPath)) {
			return DEFAULT_CONFIG;
		}
		return DEFAULT_CONFIG;
	});
}
