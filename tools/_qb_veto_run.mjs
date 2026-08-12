// Temporary QB-pass veto runner: set gates via QB_GATES env (comma-separated
// globalThis flags), then run the stat_realism harness. Lets us isolate each
// QB fix's band contribution without editing the harness. Delete after the pass.
for (const g of (process.env.QB_GATES || "").split(",")) if (g) globalThis[g] = true;
await import("./stat_realism_harness.mjs");
