# Persistent Cache Benchmark

这个项目用于对比 Rspack、webpack、Next.js Turbopack、Utoo 在生产构建和 dev 增量编译中使用 memory cache 与开启 persistent cache 后的构建耗时和 RSS。

## 指标

`npm run bench` 会按 case 和 tool 输出两个 run：`prod` 和 `dev`。一个 run 会执行一次可复用测量，并产出多个指标。

### Run: prod

- `memory-cache build`: 使用 memory cache，也就是不开启 persistent cache 时的平均构建耗时。
- `persistent build`: 开启持久化缓存后，先 warmup 写入缓存，再测后续构建的平均耗时。
- `time saved`: `memory-cache build - persistent build`，同时给出降幅百分比。
- `memory-cache peak RSS`: 使用 memory cache 构建期间的进程树峰值 RSS。
- `persistent peak RSS`: 开启持久化缓存后测量构建期间的进程树峰值 RSS。
- `RSS delta`: `persistent peak RSS - memory-cache peak RSS`。

对应的 metric id：

- `prod_build_duration_memory`
- `prod_build_duration_persistent`
- `prod_build_duration_saved`
- `prod_peak_rss_memory`
- `prod_peak_rss_persistent`
- `prod_peak_rss_delta`

### Run: dev

- `memory-cache HMR build`: 使用 memory cache 时，从写入源码文件到 bundler 完成本次 HMR 构建的平均耗时。
- `persistent HMR build`: 开启 persistent cache 时，从写入源码文件到 bundler 完成本次 HMR 构建的平均耗时。
- `HMR build saved`: `memory-cache HMR build - persistent HMR build`，同时给出降幅百分比。
- `memory-cache HMR run`: 使用 memory cache 时，从写入源码文件到浏览器端执行本次 HMR marker 的平均耗时。
- `persistent HMR run`: 开启 persistent cache 时，从写入源码文件到浏览器端执行本次 HMR marker 的平均耗时。
- `HMR run saved`: `memory-cache HMR run - persistent HMR run`，同时给出降幅百分比。
- `memory-cache RSS`: 使用 memory cache 的 dev server 在 CPU idle 后读取的 bundler 进程 RSS。
- `persistent RSS`: 开启 persistent cache 后 dev server 在 CPU idle 后读取的 bundler 进程 RSS。
- `RSS delta`: `persistent RSS - memory-cache RSS`。

对应的 metric id：

- `dev_build_duration_memory`
- `dev_build_duration_persistent`
- `dev_build_duration_saved`
- `dev_run_duration_memory`
- `dev_run_duration_persistent`
- `dev_run_duration_saved`
- `dev_peak_rss_memory`
- `dev_peak_rss_persistent`
- `dev_peak_rss_delta`

## 使用

```bash
npm install
npm run bench
```

默认会跑全部内置 case，每个 case 下分别跑 Rspack、webpack、Utoo，并同时统计 `prod` 和 `dev` 下的全部指标；Next.js Turbopack 保留为显式工具，可以用 `--tools=next` 或 `npm run bench:next` 单独测。生产 build 每种模式测 3 次；dev 每种 cache 模式持续修改 5 次文件，并在同一次 HMR run 里记录 HMR 构建完成耗时和浏览器执行耗时。结果会按 case 分开打印；每次 bench 命令会写入一个独立结果目录，目录里只有一个 Markdown 汇总和一个完整 JSON 原始报告。

查看可用 case：

```bash
npm run cases
```

当前内置 case：

- `react-1k`: 大 React 源码 case。
- `react-5k`: 更大的 React 源码 case。
- `react-10k`: 最大的 React 源码 case。
- `popular-libs`: 第三方库聚合 case。
- `ui-components`: UI 库聚合 case。

只跑某个 case：

```bash
npm run bench -- --case=react-10k --runs=3
npm run bench -- --case=react-10k --runs=3 --edits=5
```

跑多个内置 case：

```bash
npm run bench:btp-react -- --runs=1
npm run bench:btp -- --runs=1
```

只跑某几个工具：

```bash
npm run bench -- --tools=rspack,webpack
npm run bench -- --tools=next
npm run bench -- --tools=utoo
npm run bench -- --case=react-5k --tools=rspack,webpack,utoo
```

只跑某些指标时，直接写真实 metric id：

```bash
npm run bench -- --metrics=prod_build_duration_memory,prod_build_duration_persistent,prod_build_duration_saved
npm run bench -- --metrics=dev_build_duration_memory,dev_build_duration_persistent,dev_build_duration_saved
npm run bench -- --metrics=dev_run_duration_memory,dev_run_duration_persistent,dev_run_duration_saved
```

也可以进入某个 case 目录手动跑同一份配置，方便本地调试单个 case：

```bash
cd bench-cases/react-1k

npm run bench:rspack
npm run bench:rspack:persistent
npm run bench:rspack:watch
npm run bench:rspack:watch:persistent

npm run bench:webpack
npm run bench:webpack:persistent
npm run bench:webpack:watch
npm run bench:webpack:watch:persistent

npm run bench:utoo
npm run bench:utoo:persistent
npm run bench:utoo:dev
npm run bench:utoo:dev:persistent

npm run bench:next
npm run bench:next:persistent
npm run bench:next:dev
npm run bench:next:dev:persistent
```

这些命令使用 case 目录里的 `rspack.config.js`、`webpack.config.js`、`next.config.mjs`、`utoopack.config.mjs`。`bench:*:watch` 是兼容旧命名的脚本，实际会启动 Rspack/webpack dev server。`npm run bench -- --case=...` 也是直接调用同一批 case 配置文件，不再通过仓库根目录的 Rspack/webpack 配置分发。

结果会同时打印到终端并写入一个独立目录，目录名包含时间、package script、case 数量和 tool：

```text
.results/benchmark-<timestamp>-<script>-<case-or-count>-<tools>/summary.md
.results/benchmark-<timestamp>-<script>-<case-or-count>-<tools>/report.json
```

`summary.md` 会按 case 输出 `Run: prod` 和 `Run: dev` 表格，并在文件顶部记录本次运行的 package script、Node args、case、tool、metrics 和环境信息；`report.json` 保留完整原始数据。表格列由选中的 metrics 决定。比如只选择 `prod_build_duration_memory,prod_build_duration_persistent,prod_build_duration_saved` 时，只会跑一次 prod run，然后只渲染 prod 构建耗时相关列。

## 对比方式

- Rspack 使用 `cache: { type: "memory" }` 对比 `cache: { type: "persistent", storage: { type: "filesystem" } }`。
- webpack 使用 `cache: { type: "memory" }` 对比 `cache: { type: "filesystem" }`。
- Next.js 生产构建使用 `next build --turbopack`，并通过 `experimental.turbopackFileSystemCacheForBuild` 控制 Turbopack filesystem cache；dev 场景使用 `next dev --turbopack`，并通过 `experimental.turbopackFileSystemCacheForDev` 控制 Turbopack filesystem cache。Next 没有 Rspack/webpack 这种 `cache: { type: "memory" }` 公开配置。
- Utoo 使用 `persistentCaching: false` 对比 `persistentCaching: true`，CLI 命令为 `up build` / `up dev`。

`persistent build` 的测量不是第一次写缓存的耗时，而是缓存已经存在后的后续构建耗时。warmup 的耗时也会记录到 JSON，方便判断写缓存成本。

Next.js 的 Turbopack filesystem cache 位于 `distDir/cache`，所以 Next 的 persistent 测量会保留 persistent distDir；Utoo 的 persistent cache 位于 case 目录下的 `.turbopack`；Rspack/webpack/Utoo 的输出目录会在每次测量前删除，缓存目录单独保留。

不同 case 的输出和缓存目录会隔离到 case 自己目录下的 `.bench-out/<tool>`、`.bench-cache/<tool>`、`.turbopack` 和 `.bench-next/project/.next/<mode>`，避免跨 case 复用缓存。Next 的临时 App Router wrapper 也生成在 case 自己的 `.bench-next/project/app` 里。

Dev benchmark 中，脚本会临时改写每个 case 的一个已被依赖的源码文件，写入唯一的 `console.log("bench hmr", marker, Date.now())` marker，测完后恢复原文件。四个工具都会启动 dev server，Puppeteer 打开页面；每次 edit 后必须等浏览器 console 收到对应 marker，才会触发下一次 edit。这个页面完成判定和 `build-tools-performance` 一样，使用浏览器端执行完成作为边界，而不是只看 bundler 输出或产物文件。

同一次 edit 里也会记录 HMR 构建耗时：Rspack/webpack 通过 benchmark-only compiler `done` hook 输出 `[bench compile] <ms>`，Utoo 解析 dev server 的 `Compiled in <ms>` 输出。报告中的 `dev_build_duration_*` 是这个构建完成口径；`dev_run_duration_*` 是从写文件到浏览器执行 marker 的端到端口径，包含 HMR 构建、hot-update 服务/传输和浏览器执行更新模块。

## 注意

- 生产构建的峰值内存默认使用 `--memory-mode=auto`：macOS/Linux 优先用 `/usr/bin/time` 读取最大 RSS；不可用时退回 `ps` 轮询构建进程及其子进程的 RSS。`ps` 模式默认采样间隔是 50ms，可用 `--sample-interval-ms=20` 等参数调小。
- Dev benchmark 是长驻进程，`--dev-memory-mode=auto` 会使用 `pidusage` 等待 dev server 的 bundler 进程 CPU idle 后读取当前 RSS；`--dev-memory-mode=ps` 作为兼容别名也会映射到 `pidusage`，可用 `--dev-memory-mode=off` 关闭内存采样。这个口径对齐 `build-tools-performance` 的 dev RSS 读取方式，而不是持续采样峰值。
- 三个工具的构建模型不同，Next.js 包含框架构建、路由分析和 prerender 工作；这里更适合观察持久化缓存开关在同一 fixture 上的相对变化，而不是把绝对耗时当作 bundler-only 横评。
- 不要并行启动两个 `npm run bench` 进程；Next 的 `.bench-next/project/app/BenchClient.jsx` 会按当前 case 生成。单个进程内使用 `--cases=...` 会顺序执行，不会互相覆盖。
- 如果机器同时有其他高负载任务，建议增加 `--runs`，取平均值更稳。

## 扩展

脚本按 `case`、`run` 和 `metric` 分层：

- case registry 在 `scripts/cases.mjs`。新增 case 时，在 `CASES` 里加入 `id`、`entry`，并在 case 目录里放完整的 `rspack.config.js`、`webpack.config.js`、`next.config.mjs`、`utoopack.config.mjs`；如果 dev metric 需要改写非入口文件，可在 case 定义里加 `editTarget`，只有个别工具需要不同改写文件时再加 `editTargets` 覆盖对应 tool。
- run registry 在 `scripts/runs/registry.mjs`。新增 run 时，在 `scripts/runs/` 下新增模块，负责执行一次可复用测量并返回原始结果。
- metric registry 在 `scripts/metrics/registry.mjs`。新增指标时，只需要新增 metric definition，指定它属于哪个 run，以及如何从 run result 里读取和格式化值。
- 通用进程、RSS、格式化、报告写入逻辑在 `scripts/lib/`，新增指标时优先复用这些 helper。

## 清理

```bash
npm run clean
```

同时删除每个 case 下生成的 benchmark 输出、缓存和 Next app wrapper：

```bash
npm run clean:all
```
