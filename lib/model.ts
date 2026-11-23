// The value model for the token launch radar.
//
// Every number in the model comes from the snapshot alone: a protocol's TVL,
// its 7-day TVL change, how long DefiLlama has tracked it, its category and
// how many chains it runs on. No protocol name is ever hardcoded: the model
// reads only the snapshot's numeric and categorical fields.
//
// Implied value (USD) =
//   tvl_usd
//   x categoryMultiple(category)   -- what share of TVL a launch token could
//                                    plausibly capitalise, by category
//   x growthFactor(change_7d)      -- recent momentum, clamped
//   x ageFactor(listed_at, asOf)   -- track record with no token yet
//   x chainFactor(chains)          -- footprint across chains
//
// Category multiples are the model's one judgement call. A token launch
// capitalises the protocol itself, so categories whose TVL is the protocol's
// own productive base (DEXs, lending, derivatives, yield, RWA vaults) carry
// 0.20-0.38, roughly the FDV/TVL band real DeFi tokens trade in. Categories
// whose TVL is mostly somebody else's asset - a centralised exchange's
// customer balances, a bridge's locked wrapped assets, a liquid-staking
// receipt for a token that already trades - carry 0.008-0.03, because there
// is little standalone protocol value left for a new token to capture, and
// even the largest such balance (a $13B exchange) lands well below the
// leading real protocols. A protocol with no category at all gets the
// neutral 0.20.
//
// The board only ever ranks protocols that record no token (both gecko_id
// and symbol null in the snapshot). That is a statement about the record,
// never a claim that the protocol has no token: a protocol may hold a token
// its DefiLlama record does not carry.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface ModelBreakdown {
  multiple: number;
  growth: number;
  age: number;
  chains: number;
  ageDays: number | null;
}

/** A protocol records no token when the snapshot carries neither a CoinGecko id nor a ticker. */
export function recordsNoToken(p: Protocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

/**
 * The launch-value multiple for a category: the share of TVL a token issued
 * by a protocol of this kind could plausibly be worth, as a fraction.
 */
export function categoryMultiple(category: string | null): number {
  const table: Record<string, number> = {
    Dexs: 0.38,
    Lending: 0.36,
    Derivatives: 0.34,
    Chain: 0.32,
    Yield: 0.32,
    'Onchain Capital Allocator': 0.32,
    'Yield Aggregator': 0.3,
    CDP: 0.3,
    'Risk Curators': 0.3,
    'Prediction Market': 0.3,
    'Uncollateralized Lending': 0.3,
    'Interest Rate Derivatives': 0.3,
    'Leveraged Farming': 0.28,
    RWA: 0.28,
    'Basis Trading': 0.28,
    Restaking: 0.28,
    Farm: 0.28,
    'Liquidity Manager': 0.28,
    'Collateral Markets': 0.28,
    'Options Vault': 0.28,
    Payments: 0.28,
    'CDP Manager': 0.26,
    Privacy: 0.26,
    Indexes: 0.26,
    Insurance: 0.24,
    'Dual-Token Stablecoin': 0.22,
    'Governance Incentives': 0.22,
    'OTC Marketplace': 0.22,
    'Crypto Card Issuer': 0.2,
    'Decentralized BTC': 0.03,
    'Anchor BTC': 0.025,
    'Staking Pool': 0.025,
    'Stablecoin Wrapper': 0.02,
    'Liquid Staking': 0.015,
    'Liquid Restaking': 0.015,
    'Restaked BTC': 0.012,
    Bridge: 0.01,
    'Canonical Bridge': 0.01,
    'Cross Chain Bridge': 0.01,
    CEX: 0.008,
  };
  if (category === null) return 0.2;
  return table[category] ?? 0.2;
}

/** Momentum: 7-day TVL change, clamped to [-50, +100]%, mapped to [0.80, 1.40]. */
export function growthFactor(change7d: number | null): number {
  if (change7d === null) return 1;
  const clamped = Math.max(-50, Math.min(100, change7d));
  return 1 + clamped / 250;
}

/** Days between the snapshot date and the day DefiLlama began tracking the protocol. */
export function ageDays(listedAt: string | null, asOf: string): number | null {
  if (listedAt === null) return null;
  const listed = Date.parse(`${listedAt}T00:00:00Z`);
  const asOfMs = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(listed) || Number.isNaN(asOfMs)) return null;
  return Math.max(0, Math.round((asOfMs - listed) / 86400000));
}

/**
 * Track record: a protocol that has run for years with no token recorded is
 * a more seasoned launch candidate than one listed last month. 0.85 for a
 * brand-new listing, rising to 1.00 at six years; 0.92 when no listing date
 * is recorded.
 */
export function ageFactor(listedAt: string | null, asOf: string): number {
  const days = ageDays(listedAt, asOf);
  if (days === null) return 0.92;
  const years = Math.min(days / 365.25, 6);
  return 0.85 + 0.15 * (years / 6);
}

/** Footprint: 1.5% per chain, up to 8 chains, so 1.00-1.12. */
export function chainFactor(chains: string[]): number {
  return 1 + 0.015 * Math.min(chains.length, 8);
}

/** The implied launch value in whole dollars, plus the model's working. */
export function impliedValue(p: Protocol, asOf: string): { value: number; breakdown: ModelBreakdown } {
  const multiple = categoryMultiple(p.category);
  const growth = growthFactor(p.change_7d);
  const age = ageFactor(p.listed_at, asOf);
  const chains = chainFactor(p.chains);
  const value = Math.max(1, Math.round(p.tvl_usd * multiple * growth * age * chains));
  return { value, breakdown: { multiple, growth, age, chains, ageDays: ageDays(p.listed_at, asOf) } };
}

// ---------------------------------------------------------------- farm plans

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function primaryChain(p: Protocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its home chain';
}

function otherChains(p: Protocol): string {
  if (p.chains.length <= 1) return '';
  const rest = p.chains.slice(1, 4);
  return rest.length > 0 ? ` (also live on ${rest.join(', ')}${p.chains.length > 4 ? ` and ${p.chains.length - 4} more` : ''})` : '';
}

type StepFn = (p: Protocol) => string;

function dexSteps(p: Protocol): string[] {
  const c = primaryChain(p);
  return [
    `Open ${p.name} on ${c}${otherChains(p)} and connect a wallet holding at least $50 of a major asset; a first visit and wallet check takes about 10 minutes and costs nothing but a few cents of network gas.`,
    `Swap $25-$100 into the protocol's main pool token on ${c} so the swap registers as real usage; expect roughly $1-$5 in gas on ${c} and about 5 minutes for the trade to settle.`,
    `Add $50-$200 of liquidity to a ${p.name} pool on ${c} and hold the position for at least 2-4 weeks, since most farming snapshots reward sustained liquidity over one-off deposits; gas is about $2-$8 to enter.`,
    `Return once a week to claim or compound any fees the position earns and to top the pool up if it drifts; each visit takes 10-15 minutes and a small gas fee, and a steady weekly pattern reads as genuine use.`,
    `Keep a dated note of every deposit, swap and withdrawal with its transaction hash, so if ${p.name} ever asks for proof of activity you can show a clean 4-8 week history without digging through a block explorer.`,
  ];
}

function lendingSteps(p: Protocol): string[] {
  const c = primaryChain(p);
  return [
    `Connect a wallet to ${p.name} on ${c}${otherChains(p)} and deposit $100-$500 of a blue-chip asset such as ETH or a major stablecoin as collateral; the deposit takes about 10 minutes and roughly $2-$10 in gas.`,
    `Borrow a modest 30-40% of your collateral value in a stablecoin so the loan stays far from liquidation, then repay a slice after a week to show active borrowing; each borrow or repay costs a few dollars in gas and 5-10 minutes.`,
    `Leave the supply position open for 4-8 weeks and check the health factor weekly, topping up collateral if it ever drops below 1.8; a position that survives a full month with no liquidation scare is the kind farmers aim for.`,
    `Use the borrowed stablecoin in one real on-chain action, such as a swap or a deposit elsewhere, rather than letting it sit idle, so the loan looks like genuine use; budget another $2-$5 in gas and 10 minutes.`,
    `Record the deposit, borrow and repay amounts with dates and transaction hashes, and set a calendar reminder to revisit the position weekly until ${p.name} records a token or you decide to close it.`,
  ];
}

function yieldSteps(p: Protocol): string[] {
  const c = primaryChain(p);
  return [
    `Deposit $100-$300 into a ${p.name} vault or strategy on ${c}${otherChains(p)} and read the strategy page first so you know what asset it holds and what it charges; the deposit takes 10-15 minutes and about $2-$8 in gas.`,
    `Leave the deposit compounding for at least 4-6 weeks without withdrawing, since vault farming rewards patience and most snapshots look back over weeks rather than days; check the balance weekly for 5 minutes.`,
    `Compare the vault's yield against a plain holding of the same asset once a week and move only if the vault underperforms for two weeks running; each move costs a few dollars in gas and 10 minutes.`,
    `If ${p.name} offers more than one vault, split a second $50-$100 deposit into a different strategy on another chain it supports, so your activity spans chains instead of sitting in a single pool.`,
    `Save every deposit receipt and transaction hash with its date, and keep the position open until ${p.name} records a token or the strategy's yield turns negative for a full month.`,
  ];
}

function derivativesSteps(p: Protocol): string[] {
  const c = primaryChain(p);
  return [
    `Open ${p.name} on ${c}${otherChains(p)}, connect a wallet and deposit $100-$200 of collateral into the trading account; funding takes about 10 minutes and roughly $2-$8 in gas.`,
    `Place two or three small perpetual or options trades of $20-$50 each over a week, using low leverage (2x or less) and a stop-loss on every position, so the account shows real trading volume without risking the whole deposit.`,
    `Close each position within a few days and note the profit or loss, then repeat with one trade a week for 4-6 weeks; each open and close costs a few dollars in fees and gas and about 10 minutes.`,
    `Try one feature beyond plain trading, such as a limit order or a hedge on the opposite side, to show breadth of use; expect $1-$5 in fees and 10-15 minutes to set it up.`,
    `Keep a log of every trade with its size, leverage, entry and exit prices and transaction hash, and stop trading for the week if losses pass 10% of the deposit, since blown-up accounts farm nothing.`,
  ];
}

function rwaSteps(p: Protocol): string[] {
  const c = primaryChain(p);
  return [
    `Read ${p.name}'s strategy page on ${c}${otherChains(p)} to see what real-world asset backs it and what the minimum deposit and lock-up are, then deposit $100-$500; the deposit takes 10-15 minutes and about $2-$8 in gas.`,
    `Hold the position for at least 6-8 weeks, because real-world-asset strategies pay out on monthly cycles and short stays rarely register; check the accrued yield weekly for 5 minutes.`,
    `If the strategy lets you, reinvest the first month's yield back into the same vault instead of withdrawing it, so the balance compounds and the position grows; reinvesting costs a few dollars in gas.`,
    `Verify the strategy's underlying asset report or attestation once a month and withdraw if the backing ever looks stale or unaudited; a 15-minute check a month is cheap insurance against a bad vault.`,
    `Save the deposit confirmation, yield statements and transaction hashes with dates, since real-world-asset protocols are the ones most likely to ask for proof of a sustained position later.`,
  ];
}

function chainSteps(p: Protocol): string[] {
  const c = primaryChain(p);
  return [
    `Bridge $50-$150 of a major asset onto ${p.name} (${c}) using its official bridge and keep at least $20 of the chain's native token for gas; bridging takes 10-20 minutes and roughly $3-$10 in fees.`,
    `Use two or three native apps on ${p.name} over the first week - a swap, a liquidity pool and a lending market if they exist - spending $10-$30 in each, so the wallet shows breadth rather than a single transaction.`,
    `Leave $50-$100 deployed in one of those apps for 4-6 weeks and interact weekly, since chain-level farming snapshots usually reward wallets that stay active across a whole season.`,
    `If ${p.name} supports staking or delegation, stake $25-$50 with a validator and leave it for a full month; staking takes about 10 minutes and a few dollars in fees and shows long-term alignment.`,
    `Record the bridge transaction, the apps used and the amounts with dates, and keep the wallet active with at least one transaction a week until ${p.name} records a token.`,
  ];
}

function wrappedSteps(p: Protocol): string[] {
  const c = primaryChain(p);
  return [
    `Connect a wallet to ${p.name} on ${c}${otherChains(p)} and move $50-$150 into its product - a deposit, a stake or a bridge transfer - reading the fee page first; the first move takes 10-15 minutes and about $2-$8 in gas.`,
    `Hold the position for 4-6 weeks and check it weekly, because even wrapped and staked products reward sustained balances more than one-off deposits; each weekly check takes about 5 minutes.`,
    `Note that ${p.name} records no token in the snapshot, yet its category (${p.category ?? 'uncategorised'}) means it wraps or stakes an asset that already trades, so treat any future token as a long shot and never deposit more than you can afford to lock up.`,
    `If ${p.name} runs on several chains, repeat a smaller $25-$50 position on a second chain it supports, so your activity is not confined to a single network; budget another $2-$5 in gas and 10 minutes.`,
    `Save every transaction hash with its date and amount, and set a monthly reminder to review whether the position is still earning or should be withdrawn.`,
  ];
}

function defaultSteps(p: Protocol): string[] {
  const c = primaryChain(p);
  return [
    `Open ${p.name} on ${c}${otherChains(p)}, connect a wallet and make a first real interaction - a deposit, a swap or a stake of $50-$150 - after reading its fee page; the first action takes 10-15 minutes and about $2-$8 in gas.`,
    `Use the protocol once a week for 4-6 weeks with a second small action each time, since repeated weekly use is what farming snapshots usually reward; each visit takes 10 minutes and a few dollars in gas.`,
    `Keep at least $50 deployed in ${p.name} for a full month rather than depositing and withdrawing in the same week, and check the position weekly for 5 minutes to make sure it is still earning or active.`,
    `Try a second feature of ${p.name} if it has one - a different pool, market or vault - with $25-$50, so the wallet shows breadth of use across the protocol instead of a single repeated action.`,
    `Record every action with its date, amount and transaction hash, and revisit the position monthly until ${p.name} records a token or you decide the yield no longer justifies the capital.`,
  ];
}

function stepsForCategory(category: string | null): StepFn {
  switch (category) {
    case 'Dexs':
      return dexSteps;
    case 'Lending':
      return lendingSteps;
    case 'Yield':
    case 'Yield Aggregator':
    case 'Leveraged Farming':
    case 'Farm':
    case 'Liquidity Manager':
      return yieldSteps;
    case 'Derivatives':
    case 'Basis Trading':
    case 'Options Vault':
    case 'Interest Rate Derivatives':
    case 'Prediction Market':
      return derivativesSteps;
    case 'RWA':
    case 'Onchain Capital Allocator':
    case 'Risk Curators':
    case 'CDP':
    case 'CDP Manager':
    case 'Collateral Markets':
    case 'Uncollateralized Lending':
    case 'Governance Incentives':
      return rwaSteps;
    case 'Chain':
      return chainSteps;
    case 'Bridge':
    case 'Canonical Bridge':
    case 'Cross Chain Bridge':
    case 'Liquid Staking':
    case 'Liquid Restaking':
    case 'Restaked BTC':
    case 'Staking Pool':
    case 'Stablecoin Wrapper':
    case 'Anchor BTC':
    case 'Decentralized BTC':
    case 'CEX':
    case 'Crypto Card Issuer':
      return wrappedSteps;
    default:
      return defaultSteps;
  }
}

/** A concrete farm plan for one protocol: 5 steps, each naming the protocol, its chain and its costs. */
export function farmSteps(p: Protocol): string[] {
  const steps = stepsForCategory(p.category)(p);
  return steps.map((s) => s.trim()).filter((s) => s.length >= 20 && s.length <= 600);
}

export { fmtUsd };
