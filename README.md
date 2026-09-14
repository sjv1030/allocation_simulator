# Par Fund Allocation Simulator — v5

A browser implementation of the supplied `sim_v5.py` (whose internal header calls the model v14). It models three drifting asset buckets, policy liabilities, BEL/MCL and delayed capital support across a 5 × 4 allocation grid. The browser app runs entirely locally with no backend, CDN, package install or build step.

**Illustrative research only. This is based on simplified assumptions.** Read `context.pdf` for the source context, assumptions and unresolved questions.

## Open the simulator

Open `index.html` in a modern browser, choose assumptions, and select **Run simulation**. Keep its companion JS/CSS files alongside it. The page also works on any ordinary static web server or GitHub Pages. If a browser policy blocks local-file workers, serve the folder:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`. Simulations run in a worker; Cancel stops a run. Existing results keep their original settings until a new run completes. No data is uploaded anywhere.

## Repository contents

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Page, parameter controls and responsive layout |
| `engine.js` | Simulation engine, shared by browser and Node tests |
| `app.js` | Worker orchestration, charts, tables and downloads |
| `historical-data.js` | Generated, aligned history embedded for offline use |
| `xlsx.js` | Dependency-free Excel workbook exporter |
| `singapore_equity_total_return.csv` | Original STI monthly returns |
| `singapore_bond_total_return_index.csv` | Original 3–5Y and 10Y+ corporate bond returns |
| `sim_v5.py` | Unchanged reference Python model |
| `context.pdf` | Anonymized model background |
| `scripts/build_data.py` | Rebuild browser history from the two CSVs |
| `tests/` | Engine checks, Python parity checks and optional browser checks |
| `package.json`, `requirements.txt` | Optional development/test commands and Python dependencies |
| `.gitignore`, `.nojekyll` | Repository hygiene and static hosting support |

The old two-bucket HTML and its `data.csv` / `aligned_returns.csv` are not needed. The new browser history is derived directly from the latest script's two input files.

## Publish using your GitHub repository

Copy the **contents** of this folder to the root of the target repository, replacing its old `index.html` and README. Include all companion files. Commit and push using your normal GitHub workflow. In the repository's Pages settings, use the branch/folder containing `index.html` as the publishing source. No build command is needed. This delivery does not push commits or change the existing GitHub repository.

## Parameters

Percent inputs use percentage points: enter `4.25` for 4.25%. Starting PA uses billions of the model's dollar unit. The source script does not explicitly define the currency.

| Control | Default | Model field / interpretation |
| --- | --- | --- |
| Starting policy assets | $8.5bn | `pa0`; PL and BEL start at the same amount |
| Starting PSA | 30% of PA | `psa0_pct_of_pa` |
| Starting MCL | 57% of PL | `guaranteed_pct_start` |
| Required PSA floor | 20% of PA | `required_psa_pct` |
| Shortfall coverage | 50% | `shortfall_coverage`; combined PSA + capital support |
| Shareholder profit share | 10% | `profit_split_shareholder`; complementary 90% remains in PA |
| Guaranteed rate | 4.25% annually | `guarantee_rate`; monthly PL drift |
| BEIR | 5.25% annually | `beir_rate`; BEL discount and default growth |
| Risk-free rate | 3.75% annually | `risk_free_rate`; MCL discount and default growth |
| BEL / MCL growth overrides | Blank | Follow BEIR / risk-free rate unless explicitly entered |
| Horizon | 2 years | `n_years`; 24 investment months + 1 reporting month |
| Paths per allocation | 1,000 | `n_sims` |
| Method | GBM | `method`; alternatively joint block bootstrap |
| Block length | 12 months | `block_size_months`; 6, 9 or 12 |
| Profit checks | Periodic + final | `periodic_profit_check` |
| Checkpoint interval | 12 months | `bonus_freq_months`; final horizon is always checked |
| Seed | 42 | `random_seed` |

The grid matches Python: equity weights 20%, 25%, 30%, 35%, 40%; 10Y+ shares of the remaining bonds 60%, 70%, 80%, 90%. The initial detail allocation is 30% equity / 70% of bonds in 10Y+.

`profit_split_policyholder` in Python is not independently used by the engine. The page derives it as the complement of the shareholder share. Starting PSA is similarly derived from PA and its percentage.

Browser limits are 1–50 years, 1–50,000 paths, and at most 2 million path-months per allocation. Annual rate inputs must exceed -100% and be at most 100%; capital fractions are bounded to 0–100%. These UI guards prevent invalid or impractical browser runs.

## Accounting and timing

1. At the **start** of a month, apply the prior checkpoint's PSA draw, Cap injection and shareholder profit share, distributed proportionally across existing asset buckets. PSA receives profit shares and pays draws; it does not earn an independent return.
2. If a reset is pending, set PL to `max(post-capital PA, queued PV_BEL, queued PV_MCL)`. Then apply this month's guaranteed-rate drift to PL.
3. Compound each asset bucket using its own return. BEL and MCL grow at their monthly-equivalent annual rates. There is no rebalancing.
4. At a checkpoint, measure `profit = PA - PL`. A positive profit generates a shareholder profit share. Otherwise compute the shortfall and multiply it by the coverage fraction.
5. PSA draw is the lesser of covered shortfall and `max(PSA - required_psa_pct × (checkpoint PA - decided profit share), 0)`. Capital injection supplies all remaining covered shortfall. **The floor is based on checkpoint PA before support, not PA after next-month support or investment returns.** An initially inadequate PSA is not automatically replenished.
6. The uncovered amount is the total shortfall less PSA draw and Cap injection. Its cumulative total is reporting only and creates no future obligation.
7. Queue `BEL / (1 + BEIR)` and `MCL / (1 + risk-free rate)`, using a fixed one-year discount exponent. The reset and all capital decisions take effect next month.

Returns use post-capital opening PA, so injections and profit shares do not count as investment performance. CAGR and terminal returns use exactly `n_years × 12` returns. The extra month includes both final settlement and another month's growth, like Python; it is excluded from return metrics.

### Source distinctions preserved

- The UI defaults to annual checks as described in the PDF and `SimConfig`. Python's `argparse` default is **final-only** unless `--periodic_profit_check` is supplied. Select Final horizon only to reproduce that CLI setting.
- All scenarios share one simulated set of raw returns. Pooled charts therefore contain scenario-path observations, not 20 independently generated samples.
- `pct_paths_psa_only` means at least one checkpoint used PSA without injection **at that checkpoint**. It can overlap the “ever injection” metric. The example category “PSA draw, no injection ever” is stricter.
- “Injection then recovery” means injection at an earlier checkpoint and none at the final checkpoint; a final shortfall can still exist.
- The PDF mentions 169 months; the supplied CSVs yield **168 usable overlapping months, August 2012–July 2026**, after dropping the initial missing bond-return row. This matches Python's cleaning logic.
- The browser uses seeded Mulberry32 and Box–Muller normal draws; NumPy uses a different generator. Matching numerical seeds do **not** yield identical Python/browser paths. Mechanics are validated with identical raw return arrays instead.

## Outputs

- 20-row results table and CSV: mean/median/P05/P95 CAGR, below-guarantee probability, no-shortfall probability, PSA-only-event probability, injection probability, and mean cumulative Cap injection. Mean injection averages all paths, including zeros. A supplemental mean cumulative uncovered-shortfall column is included.
- Pooled CAGR and terminal return histograms, with mean and guarantee markers. Histogram bars use counts; the Python CAGR plot uses density.
- Allocation heatmap with mean CAGR in bold, capital injection probability underneath, and a fixed 0–100% injection color scale.
- First 25 actual PA paths for the selected allocation, including the extra settlement month.
- Asset mean/volatility statistics and CSV, using sample covariance / standard deviation (`ddof=1`).
- True `.xlsx` example-path workbook with `scenario_info` and four outcome sheets, retaining full precision. Each category uses its first matching path; categories may overlap. Missing categories get an explicit note.
- Selected example-path CSV and on-screen audit table. Downloads include original Python path columns plus opening PA after capital, PL before monthly drift at a reset, covered shortfall and a continuously visible cumulative uncovered total.

The audit table's **PL reset driver** column identifies which value sets PL at the start of the month following a checkpoint. Highlighted **PV BEL** or **PV MCL** means that liability present value strictly exceeds post-capital opening PA. **PA** includes ties; a dash means there is no reset that month. This comparison uses the prior checkpoint's queued present values, before the new month's investment returns and liability growth. Downloads include `PL_reset_driver` and `liability_sets_PL_reset` (true/false at resets, blank otherwise). The flag is reporting only and does not change the model.

## Update historical data

Replace the two original CSVs, preserving their column names and date format. Then run:

```sh
python scripts/build_data.py
```

Commit the regenerated `historical-data.js` together with the CSVs. Equity return values and bond percent strings are divided by 100. Rows merge on exact date, sort chronologically and drop missing returns. Merely changing a CSV without regenerating the JS does not change the app's inputs.

## Validation and development

No dependencies are required to use the app. Engine tests require Node.js:

```sh
npm test
```

Python parity tests require NumPy and pandas. The reference model's plotting imports are omitted during tests; the accounting implementation is unchanged:

```sh
python tests/parity.py
```

The parity suite compares 36,848 fields across 56 deterministic paths and seven configurations, plus example selection and summary statistics. It covers profit shares, repeated shortfalls, recovery, zero/full coverage, insufficient PSA, final-only/irregular/monthly checkpoints and separate growth/discount rates. JS tests cover reproducibility, input validation, sampled GBM means and joint non-wrapping bootstrap blocks.

Optional browser smoke checks require Playwright and Microsoft Edge:

```sh
node tests/browser.cjs
```

To run the original Python script and its plots/Excel outputs, install `requirements.txt`, then run from this folder:

```sh
python sim_v5.py --periodic_profit_check
```

## Assumptions and open items

The 57% guaranteed-benefit share and 90:10 split are described as insurer-confirmed in the background PDF. Initial PA is inferred; the guarantee range was sourced externally. PSA size/floor, coverage, BEIR, risk-free rate and simplified liability growth/discounting remain assumptions. Actual liability cash-flow schedules, BEIR construction, MCL discount curve, PSA sizing methodology, bonus payout timing and policyholder behavior are unresolved. The port preserves the provided illustrative model; it does not supply those missing actuarial details.
