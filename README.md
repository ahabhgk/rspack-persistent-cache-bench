# Persistent Cache Benchmark

- Created: 2026-07-08T11:09:56.788Z
- Package script: `bench`
- Script command: `node scripts/bench.mjs`
- Node args: none
- Metrics: prod_build_duration_memory, prod_build_duration_persistent, prod_build_duration_saved, prod_peak_rss_memory, prod_peak_rss_persistent, prod_peak_rss_delta, dev_build_duration_memory, dev_build_duration_persistent, dev_build_duration_saved, dev_run_duration_memory, dev_run_duration_persistent, dev_run_duration_saved, dev_peak_rss_memory, dev_peak_rss_persistent, dev_peak_rss_delta
- Tools: rspack, webpack, utoo
- Node: v24.18.0
- Platform: linux/x64
- CPUs: 4
- Total memory: 15988.70 MB
- Cases: react-1k, react-5k, react-10k, popular-libs, ui-components, tailwind-hmr, all
- Packages: @rspack/core@2.1.2, @rspack/cli@2.1.2, @swc/core@1.15.43, swc-loader@0.2.7, @utoo/pack-cli@1.4.17, webpack@5.108.4, webpack-cli@7.2.1, next@16.2.10, react@19.2.7, react-dom@19.2.7

## Case: react-1k

- ID: react-1k
- Entry: bench-cases/react-1k/src/index.jsx
- Dev edit target: bench-cases/react-1k/src/d0/d0/d0/f0.jsx

### Run: prod

| tool | 仅内存缓存生产构建耗时 | 持久化缓存生产构建耗时 | 持久化缓存生产构建耗时减少 | 仅内存缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack | 0.63s | 0.30s | +0.33s (+52.06%) | 318.13 MB | 318.65 MB | +0.52 MB |
| webpack | 13.85s | 1.60s | +12.26s (+88.47%) | 1127.14 MB | 400.23 MB | -726.91 MB |
| Utoo | 3.05s | 0.26s | +2.79s (+91.51%) | 382.44 MB | 274.13 MB | -108.31 MB |

### Run: dev

| tool | 仅内存缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时减少 | 仅内存缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时减少 | 仅内存缓存RSS | 持久化缓存RSS | 持久化缓存RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack dev | 49.40ms | 55.00ms | -5.60ms (-11.34%) | 506.20ms | 516.80ms | -10.60ms (-2.09%) | 390.36 MB | 410.67 MB | +20.31 MB |
| webpack dev | 282.20ms | 304.40ms | -22.20ms (-7.87%) | 698.00ms | 843.20ms | -145.20ms (-20.80%) | 648.32 MB | 757.67 MB | +109.36 MB |
| Utoo dev | 32.00ms | 24.60ms | +7.40ms (+23.12%) | 46.00ms | 38.80ms | +7.20ms (+15.65%) | 498.37 MB | 540.03 MB | +41.67 MB |

## Case: react-5k

- ID: react-5k
- Entry: bench-cases/react-5k/src/index.jsx
- Dev edit target: bench-cases/react-5k/src/d0/d0/d0/f0.jsx

### Run: prod

| tool | 仅内存缓存生产构建耗时 | 持久化缓存生产构建耗时 | 持久化缓存生产构建耗时减少 | 仅内存缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack | 1.31s | 0.76s | +0.55s (+42.02%) | 548.80 MB | 674.40 MB | +125.60 MB |
| webpack | 24.36s | 3.43s | +20.93s (+85.93%) | 1549.45 MB | 880.83 MB | -668.61 MB |
| Utoo | 8.34s | 0.46s | +7.89s (+94.54%) | 754.08 MB | 406.98 MB | -347.10 MB |

### Run: dev

| tool | 仅内存缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时减少 | 仅内存缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时减少 | 仅内存缓存RSS | 持久化缓存RSS | 持久化缓存RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack dev | 39.80ms | 36.80ms | +3.00ms (+7.54%) | 383.40ms | 378.00ms | +5.40ms (+1.41%) | 352.79 MB | 387.09 MB | +34.31 MB |
| webpack dev | 791.40ms | 861.60ms | -70.20ms (-8.87%) | 1089.00ms | 1656.60ms | -567.60ms (-52.12%) | 1207.82 MB | 1564.54 MB | +356.71 MB |
| Utoo dev | 130.00ms | 131.80ms | -1.80ms (-1.38%) | 144.60ms | 146.80ms | -2.20ms (-1.52%) | 1118.08 MB | 1240.44 MB | +122.36 MB |

## Case: react-10k

- ID: react-10k
- Entry: bench-cases/react-10k/src/index.jsx
- Dev edit target: bench-cases/react-10k/src/d0/d0/d0/f0.jsx

### Run: prod

| tool | 仅内存缓存生产构建耗时 | 持久化缓存生产构建耗时 | 持久化缓存生产构建耗时减少 | 仅内存缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack | 2.27s | 1.32s | +0.95s (+41.86%) | 893.66 MB | 1100.42 MB | +206.76 MB |
| webpack | 53.29s | 5.98s | +47.31s (+88.78%) | 2355.25 MB | 1409.09 MB | -946.16 MB |
| Utoo | 15.76s | 0.68s | +15.08s (+95.69%) | 1246.54 MB | 550.19 MB | -696.35 MB |

### Run: dev

| tool | 仅内存缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时减少 | 仅内存缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时减少 | 仅内存缓存RSS | 持久化缓存RSS | 持久化缓存RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack dev | 48.60ms | 52.80ms | -4.20ms (-8.64%) | 505.40ms | 513.60ms | -8.20ms (-1.62%) | 386.13 MB | 449.57 MB | +63.45 MB |
| webpack dev | 1609.40ms | 1846.80ms | -237.40ms (-14.75%) | 1999.20ms | 3519.60ms | -1520.40ms (-76.05%) | 2127.25 MB | 2413.18 MB | +285.93 MB |
| Utoo dev | 211.20ms | 222.20ms | -11.00ms (-5.21%) | 225.80ms | 237.20ms | -11.40ms (-5.05%) | 1942.50 MB | 2013.13 MB | +70.62 MB |

## Case: popular-libs

- ID: popular-libs
- Entry: bench-cases/popular-libs/src/index.js
- Dev edit target: bench-cases/popular-libs/src/index.js

### Run: prod

| tool | 仅内存缓存生产构建耗时 | 持久化缓存生产构建耗时 | 持久化缓存生产构建耗时减少 | 仅内存缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack | 1.81s | 0.32s | +1.49s (+82.41%) | 430.27 MB | 346.89 MB | -83.39 MB |
| webpack | 29.80s | 1.59s | +28.22s (+94.68%) | 1938.28 MB | 444.44 MB | -1493.84 MB |
| Utoo | 5.00s | 0.23s | +4.78s (+95.47%) | 496.32 MB | 271.06 MB | -225.26 MB |

### Run: dev

| tool | 仅内存缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时减少 | 仅内存缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时减少 | 仅内存缓存RSS | 持久化缓存RSS | 持久化缓存RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack dev | 63.00ms | 73.40ms | -10.40ms (-16.51%) | 520.00ms | 526.80ms | -6.80ms (-1.31%) | 492.53 MB | 522.12 MB | +29.59 MB |
| webpack dev | 180.40ms | 250.40ms | -70.00ms (-38.80%) | 839.00ms | 1181.60ms | -342.60ms (-40.83%) | 711.73 MB | 796.95 MB | +85.21 MB |
| Utoo dev | 17.60ms | 16.80ms | +0.80ms (+4.55%) | 240.00ms | 235.00ms | +5.00ms (+2.08%) | 493.93 MB | 565.37 MB | +71.44 MB |

## Case: ui-components

- ID: ui-components
- Entry: bench-cases/ui-components/src/entry.js
- Dev edit target: bench-cases/ui-components/src/hmr-marker.js

### Run: prod

| tool | 仅内存缓存生产构建耗时 | 持久化缓存生产构建耗时 | 持久化缓存生产构建耗时减少 | 仅内存缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack | 4.99s | 1.59s | +3.40s (+68.17%) | 998.21 MB | 1901.09 MB | +902.88 MB |
| webpack | 63.67s | 64.43s | -0.76s (-1.19%) | 4266.71 MB | 4272.82 MB | +6.12 MB |
| Utoo | 16.18s | 0.44s | +15.74s (+97.28%) | 1076.72 MB | 437.94 MB | -638.78 MB |

### Run: dev

| tool | 仅内存缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时减少 | 仅内存缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时减少 | 仅内存缓存RSS | 持久化缓存RSS | 持久化缓存RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack dev | 160.20ms | 164.60ms | -4.40ms (-2.75%) | 530.40ms | 626.60ms | -96.20ms (-18.14%) | 1003.30 MB | 946.72 MB | -56.59 MB |
| webpack dev | 971.80ms | 983.40ms | -11.60ms (-1.19%) | 1040.80ms | 1063.20ms | -22.40ms (-2.15%) | 2079.77 MB | 2132.89 MB | +53.12 MB |
| Utoo dev | 87.20ms | 98.20ms | -11.00ms (-12.61%) | 101.00ms | 112.60ms | -11.60ms (-11.49%) | 1234.54 MB | 1365.99 MB | +131.46 MB |

## Case: tailwind-hmr

- ID: tailwind-hmr
- Entry: bench-cases/tailwind-hmr/src/main.js
- Dev edit targets: rspack: bench-cases/tailwind-hmr/src/component.tsx, webpack: bench-cases/tailwind-hmr/src/component.tsx, utoo: bench-cases/tailwind-hmr/src/main.js

### Run: prod

| tool | 仅内存缓存生产构建耗时 | 持久化缓存生产构建耗时 | 持久化缓存生产构建耗时减少 | 仅内存缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack | 3.73s | 0.44s | +3.29s (+88.22%) | 1002.39 MB | 551.18 MB | -451.21 MB |
| webpack | 12.78s | 2.43s | +10.35s (+80.97%) | 1458.69 MB | 652.83 MB | -805.86 MB |
| Utoo | 11.30s | 0.43s | +10.87s (+96.19%) | 1964.50 MB | 429.00 MB | -1535.49 MB |

### Run: dev

| tool | 仅内存缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时减少 | 仅内存缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时减少 | 仅内存缓存RSS | 持久化缓存RSS | 持久化缓存RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack dev | 1427.40ms | 1550.00ms | -122.60ms (-8.59%) | 3647.40ms | 3753.40ms | -106.00ms (-2.91%) | 1954.76 MB | 1967.93 MB | +13.17 MB |
| webpack dev | 1824.40ms | 1956.20ms | -131.80ms (-7.22%) | 4501.60ms | 5582.00ms | -1080.40ms (-24.00%) | 2070.78 MB | 2591.45 MB | +520.66 MB |
| Utoo dev | 971.40ms | 964.80ms | +6.60ms (+0.68%) | 2184.60ms | 2174.20ms | +10.40ms (+0.48%) | 2563.22 MB | 2626.10 MB | +62.88 MB |

## Case: all

- ID: all
- Entry: bench-cases/all/src/entry.js
- Dev edit target: bench-cases/all/src/entry.js

### Run: prod

| tool | 仅内存缓存生产构建耗时 | 持久化缓存生产构建耗时 | 持久化缓存生产构建耗时减少 | 仅内存缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS | 持久化缓存生产构建峰值RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack | 6.60s | 1.78s | +4.82s (+73.05%) | 1453.99 MB | 1270.24 MB | -183.74 MB |
| webpack | 83.12s | 7.65s | +75.46s (+90.79%) | 5636.99 MB | 1887.89 MB | -3749.10 MB |
| Utoo | 33.01s | 1.17s | +31.85s (+96.47%) | 2039.09 MB | 593.50 MB | -1445.59 MB |

### Run: dev

| tool | 仅内存缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时 | 持久化缓存HMR构建完成耗时减少 | 仅内存缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时 | 持久化缓存HMR浏览器执行耗时减少 | 仅内存缓存RSS | 持久化缓存RSS | 持久化缓存RSS增加 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rspack dev | 253.20ms | 253.60ms | -0.40ms (-0.16%) | 385.20ms | 380.00ms | +5.20ms (+1.35%) | 1383.28 MB | 1470.38 MB | +87.10 MB |
| webpack dev | 1705.20ms | 1612.00ms | +93.20ms (+5.47%) | 1860.20ms | 3050.40ms | -1190.20ms (-63.98%) | 3070.41 MB | 3896.42 MB | +826.01 MB |
| Utoo dev | 285.80ms | 298.60ms | -12.80ms (-4.48%) | 302.20ms | 316.20ms | -14.00ms (-4.63%) | 2623.20 MB | 2825.26 MB | +202.05 MB |
