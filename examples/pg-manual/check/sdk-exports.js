// Static-import probe for the @e4a/pg-wasm exports the examples rely on.
//
// examples/string.js and examples/file.js reach the SDK through a dynamic
// `import('@e4a/pg-wasm')` and destructure at runtime, which webpack cannot
// analyse — a removed or renamed export still compiles cleanly. Importing the
// same names statically here puts them back under webpack's export analysis,
// so `npm run check` fails when the SDK drops one.
//
// Keep this list in step with what the examples destructure. A new name goes in
// both places below: webpack elides an unreferenced import, so adding one to the
// import alone probes nothing and leaves the check passing.
import { seal, sealStream, Unsealer, StreamUnsealer } from '@e4a/pg-wasm'

// Referencing the bindings keeps them from being elided before the check runs.
for (const [name, binding] of Object.entries({ seal, sealStream, Unsealer, StreamUnsealer })) {
    if (binding === undefined) throw new Error(`@e4a/pg-wasm no longer exports ${name}`)
}
