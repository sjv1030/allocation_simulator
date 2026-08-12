# Two-Bucket Allocation Simulator

An interactive, browser-based block-bootstrap Monte Carlo tool for testing a
bond/equity portfolio against a compounding guarantee. Runs entirely
client-side — no server, no backend — and deploys as a GitHub Pages site.

- **Guarantee rate** — type a percent (e.g. `4.5` = 4.5%/yr)
- **Horizon** — 2 / 5 / 10 years
- **Block size** — 3 / 6 / 9 / 12 months (annual monitoring checkpoints stay at
  months 12, 24, 36 … regardless of block size)
- 50,000 paths × 20 allocations, recomputed in ~1–2 seconds
- Inline interactive charts: shortfall heatmap, illustrative paths, terminal
  distribution, and a full sorted summary grid

---

## Files in this bundle

| File | What it is |
|------|-----------|
| `index.html` | The whole app (self-contained). |
| `aligned_returns.csv` | Your monthly return series. |
| `README.md` | This file. |

---

### Step 4 — Turn on GitHub Pages

1. In the repo, go to **Settings → Pages** (left sidebar).
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. **Branch:** `main`, folder: `/ (root)`. Click **Save**.
4. Wait ~1 minute. The page will show your live URL:

   ```
   https://sjv1030.github.io/allocation-simulator/
   ```

Open it — you should see the tool load your data and run automatically.

---

## Updating the data later

Replace `aligned_returns.csv` in the repo (Add file → Upload files → commit).
The live site picks up the new data on the next load — no code change needed,
because the app fetches with cache disabled.

## Changing the fixed assumptions

The allocation grid, path count, seed, and the selected allocation for the
detail charts are constants at the top of the `<script>` block in `index.html`
(`N_SIMS`, `SEED`, `BOND_WEIGHTS`, `LONG_BOND_SHARES`, `SELECT_BOND_WEIGHT`,
`SELECT_LONG_SHARE`). The horizon and block-size toggle options are
`HORIZON_OPTIONS` and `BLOCK_OPTIONS`. Edit and commit.

## CSV format

Header row plus one row per month. Column names must match exactly (order and
extra columns don't matter):

```
date,equity_return,bond_3_5_return,bond_10_plus_return
2012-08-31,-0.00418,0.00370,0.01604
...
```

Returns are decimals (0.01 = 1%), not percents.

## A note on reproducibility

The engine uses a fixed seed, so the tool gives the same numbers every run for a
given set of inputs. It uses a JavaScript RNG rather than NumPy's, so absolute
path-level values won't be bit-identical to a Python run of the same model, but
the distributions and summary statistics are equivalent.
