# Tools

Reusable scripts that work across topics. Stays local (gitignored) because tools are personal — API keys, preferences, specific data sources.

## Usage

Drop any executable `.ts` file here. Run via:

    bun run lab tool <topic-slug> <tool-name> [-- args...]

Output is captured to `topics/<topic-slug>/computations/<tool-name>.output.md` with provenance.

List available tools:

    bun run lab tools

## Example

    tools/drive-matrix.ts

    bun run lab tool oahu-trip drive-matrix -- --points "waikiki,kailua,north-shore"

Output captured to `topics/oahu-trip/computations/drive-matrix.output.md` citing the tool and args used.

## Writing a tool

Tools use `defineTool` from `src/tool-runner.ts` and must be Effect-native — no try/catch, no if-statements, no ternaries.

Minimal scaffold:

```ts
import { Effect, Option, Schema } from "effect";
import { requireKey } from "../src/env";
import { defineTool, fetchJson, readJsonFile } from "../src/tool-runner";

const Args = Schema.Struct({
  "my-file": Schema.optional(Schema.String),
});

function program(args: typeof Args.Type) {
  const e = Effect.gen(function* () {
    const file = Option.getOrElse(
      Option.fromNullishOr(args["my-file"]),
      () => "computations/default.json",
    );
    // ... read files, fetch APIs, build output string
    return "markdown output";
  });
  return e;
}

export default await defineTool({ name: "my-tool", args: Args, run: program });
```

Key rules:
- Args schema: use `Schema.optional(Schema.String)` for optional fields; apply defaults with `Option.getOrElse` in the program body.
- No `const x = "string"` at module scope (linteffect: `no-string-sentinel-const`).
- No `Effect.succeed("literal")` (linteffect: `no-string-sentinel-return`).
- `program` must assign `Effect.gen(...)` to a local variable before returning (linteffect: `no-effect-wrapper-alias`).
- Nest Effect calls flat: assign inner Effects to variables before passing to outer ones (linteffect: `no-nested-effect-call`).
- Helpers: `readJsonFile(path, Schema)`, `fetchJson(url, init, Schema)`.

linteffect covers `tools/` in the `lint` and `lint:effect` scripts.

## API keys

Keys go in `.env` at the repo root (gitignored). See `.env.example` for the template.

Known keys are defined in `EnvSchema` in `src/env.ts`. Adding a new key:
1. Add it to `EnvSchema` in `src/env.ts`
2. Add it to `.env.example` (tracked template)
3. Add the value to `.env` (your local file)

Tools access keys via the shared helpers:

    import { requireKey, env } from "../src/env"

    // required — throws with a helpful message if missing
    const apiKey = requireKey("OPENROUTESERVICE_API_KEY", { tool: "drive-matrix" })

    // optional — read directly from the typed env object
    const optional = env.HERE_API_KEY  // string | undefined

TypeScript only allows keys defined in `EnvSchema`. Unknown keys are caught at compile time.
