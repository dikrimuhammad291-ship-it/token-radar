# Token Launch Radar

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/dikrimuhammad291-ship-it/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/dikrimuhammad291-ship-it/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A dashboard that ranks the protocols in DefiLlama's sealed snapshot that **record no token** by the implied value of a token launch, and shows how to farm each one.

## What it does

`main.ts` reads the snapshot, keeps every protocol on the watchlist plus the 160 highest-TVL records-no-token protocols below the floor (200 rows), scores each one, and writes:

- `board.json` — the ranked board with an implied value and a farm plan per protocol
- `data.js` — the same board for the dashboard
- `dashboard/` — the static page (sortable, filterable, detail view per protocol)
- `screenshots/` — three captures of the dashboard
- `dossier.json` — the dossier the judge reads, built with the kit's `vendor/makefun-board.ts`

## The value model

```
implied_value_usd = tvl_usd
  × categoryMultiple(category)
  × growthFactor(change_7d)
  × ageFactor(listed_at, as_of)
  × chainFactor(chains)
```

Only the snapshot's own figures are used: TVL, 7-day change, how long the protocol has been listed, its category and its chain count. No protocol name is hardcoded. Category multiples run 0.008–0.38: a launch token capitalises the protocol itself, so core categories (DEXs, lending, derivatives, yield) score high, while wrapped or exchange products (CEX, bridges, liquid staking) score low because their TVL is somebody else's asset. Growth is the 7-day TVL change clamped to [-50, +100]% mapped to [0.80, 1.40]. Age runs 0.85 for a new listing to 1.00 at six years. Chains add 1.5% each, up to 8.

“Records no token” means the snapshot carries no CoinGecko id and no ticker for the protocol — a statement about the record, never a claim that the protocol has no token.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

Requires Node.js 22.18 or later. Two runs over the same snapshot write byte-identical output. Standard library only, no network.
