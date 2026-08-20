# Two-Bucket Allocation Simulator

An interactive, browser-based Monte Carlo tool for testing a bond/equity
portfolio against a compounding guarantee. Each sleeve is simulated as its own
geometric Brownian motion from an annual return and volatility assumption, with
the cross-asset correlation taken from history. Runs entirely client-side — no
server, no backend — and deploys as a GitHub Pages site.

- **Guarantee rate** — type a percent (e.g. `4.5` = 4.5%/yr)
- **Horizon** — 2 / 5 / 10 years
- **Paths per allocation** — 10k / 25k / 50k
- **Assumptions** — Historical (annualized mean and standard deviation of the
  loaded series) or Custom (type your own annual return and volatility for any
  of the three sleeves)
- Shortfall is tested once, at the end of the horizon
- 20 allocations recomputed in ~1 second at 50k paths
- Inline interactive charts: shortfall heatmap, illustrative paths, terminal
  distribution, and a full sorted summary grid — click any row to redraw the
  detail charts for that allocation

---

## Files in this bundle

| File | What it is |
|------|-----------|
| `index.html` | The whole app (self-contained). |
| `aligned_returns.csv` | Your monthly return series — the file the Python model writes. |
| `README.md` | This file. |

---

## Deploy to GitHub Pages — step by step

Your GitHub account: **https://github.com/sjv1030**

### Step 1 — Create a repository

1. Go to https://github.com/new
2. **Repository name:** anything you like — e.g. `allocation-simulator`.
3. Set it to **Public** (GitHub Pages on the free plan needs public repos).
4. Leave "Add a README" unchecked (you already have one).
5. Click **Create repository**.

### Step 2 — Upload the three files

1. On the new repo's page, click **Add file → Upload files**.
2. Drag in **`index.html`**, **`aligned_returns.csv`**, and
   **`README.md`**.
3. Click **Commit changes**.

### Step 3 — Check the data path

The app looks for the CSV next to `index.html`, so if you kept the filename
above there is nothing to change. Near the top of the `<script>` block:

```js
const DATA_CSV_URL = "aligned_returns.csv";
```

If you renamed the file, or you want to host the data in a different repo, put
the raw URL there instead:

```js
const DATA_CSV_URL = "https://raw.githubusercontent.com/sjv1030/allocation-simulator/main/aligned_returns.csv";
```

(To be certain of a raw URL, click the CSV in your repo, then the **Raw**
button, and copy the address bar.)

> If the file can't be loaded, the page still works but runs on **synthetic demo
> data** and shows a red status dot naming the file it tried. A successful load
> shows a green dot and "Calibrated on N monthly observations from hosted data."

### Step 4 — Turn on GitHub Pages

1. In the repo, go to **Settings → Pages** (left sidebar).
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. **Branch:** `main`, folder: `/ (root)`. Click **Save**.
4. Wait ~1 minute. The page will show your live URL:

   ```
   https://sjv1030.github.io/allocation_simulator/
   ```

Open it — you should see the tool load your data and run automatically.

---

## Using the assumption inputs

The three sleeves — Bonds 3-5Y, Bonds 10Y+, Equity — each take an **annual
return** and an **annual volatility**.

- **Historical** locks the fields and fills them from the loaded series:
  annual return is `(1 + monthly mean)^12 − 1`, annual volatility is
  `monthly stdev × √12`.
- **Custom** unlocks the fields, pre-filled with those historical values so you
  are editing from a sensible base. A per-row tag flips from `history` to
  `custom` as soon as a number differs, so a mixed set — say a forward-looking
  equity number with historical bonds — is visible at a glance. **Reset to
  historical** restores everything.

Internally the annual inputs convert to monthly (`(1+r)^(1/12) − 1` for the
mean, `σ/√12` for the volatility) and then to the textbook GBM log-space
parameters, drift `μ − ½σ²` and volatility `σ`.

**Correlation is always historical.** It is shown read-only next to the inputs
and is not something the return and volatility fields can set. Your drift and
volatility can be forward-looking while the diversification between sleeves
stays the realised relationship — worth remembering when reading the results.

## Updating the data later

Replace `aligned_returns.csv` in the repo (Add file → Upload files
→ commit). The live site picks up the new data on the next load — no code
change needed, because the app fetches with cache disabled. Historical
assumptions and the correlation matrix recalibrate automatically.

## Changing the fixed assumptions

The allocation grid, seed, and the allocation selected on load are constants at
the top of the `<script>` block in `index.html` (`SEED`, `BOND_WEIGHTS`,
`LONG_BOND_SHARES`, `SELECT_BOND_WEIGHT`, `SELECT_LONG_SHARE`,
`N_ILLUSTRATIVE_PATHS`). The toggle options are `HORIZON_OPTIONS` and
`NSIM_OPTIONS`. `CHUNK_PATHS` controls how many paths share one block of
simulated shocks — leave it alone unless you hit memory limits on very long
horizons. Edit and commit.

## CSV format

Header row plus one row per month. Column names must match exactly (order and
extra columns don't matter):

```
date,bond_3_5_return,bond_10_plus_return,equity_return
2012-08-31,0.00370,0.01604,-0.00418
...
```

Returns are decimals (0.01 = 1%), not percents. At least 24 rows are needed to
calibrate.

## A note on reproducibility

The engine uses a fixed seed, so the tool gives the same numbers every run for a
given set of inputs. The same block of simulated shocks is reused across all 20
allocations, so differences between cells in the grid come from the weights
alone, not from sampling noise.

It uses a JavaScript RNG rather than NumPy's, so path-level values won't be
bit-identical to a Python run of the same model — summary statistics agree to
within Monte Carlo noise (roughly a tenth of a percentage point on shortfall
probabilities at 50k paths).

## What the GBM engine does and doesn't capture

Returns are drawn independently each month and are lognormal by construction.
That preserves the mean, volatility and cross-asset correlation of the inputs,
but it deliberately drops serial correlation, regime persistence and the fat
tails of the realised sample. For a guarantee study this generally makes the
tail thinner than a historical block bootstrap would: read the shortfall
probabilities as the lognormal-world answer, not as a stress case.
