const PLUGIN_NAME = "BenchCompileTimingPlugin";

function createBenchCompileTimingPlugin() {
  return {
    apply(compiler) {
      compiler.hooks.done.tap(PLUGIN_NAME, (stats) => {
        const durationMs = stats?.endTime != null && stats?.startTime != null ? stats.endTime - stats.startTime : null;
        if (durationMs == null) {
          process.stdout.write("[bench compile] n/a\n");
          return;
        }
        process.stdout.write(`[bench compile] ${durationMs}ms\n`);
      });
    }
  };
}

module.exports = createBenchCompileTimingPlugin;
