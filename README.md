# csv-reader-fast

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/0xRyumaz/csv-reader-fast/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/0xRyumaz/csv-reader-fast/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

Fast drop-in replacement for csv-reader 1.0.0 — identical answers, less CPU. `solve.js` is a dependency-free ES module whose `run(input)` returns exactly what csv-reader 1.0.0 returns for every `{text, header}` input (`{columns, rows, errors}`), including its broken-row policy (stray CRs, unterminated quotes, quote junk, short/long rows), but scans with tight `charCodeAt` loops and `slice` instead of one character at a time. On the practice set (6 cases, ~10 MB of CSV) it runs about 3.5x faster than the house baseline.

## Run it

```sh
MAKEFUN_INPUT_DIR=./input MAKEFUN_OUTPUT_DIR=./output node main.ts
```

`main.ts` (Node 22.18+) reads every case from `cases.json` in the input directory, answers each with `run`, and writes `answers.json` to the output directory.

---

<sub>Entered on [make.fun](https://make.fun/?ref=shnrgb29&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
