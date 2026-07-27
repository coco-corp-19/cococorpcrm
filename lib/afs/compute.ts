import type { AutoSource } from "./catalog";

// Auto-derived figures for one financial year, computed from the fact tables
// as at the year-end (balance-sheet items) or over the year (income items).
export type AutoFigures = Record<AutoSource, number>;

type Inv = { amount: number; status: string; transaction_date: string };
type Cost = { amount: number; transaction_date: string; cost_type?: string; depreciation_months?: number | null; residual_value?: number | null; disposed_at?: string | null };
type Income = { amount: number; transaction_date: string };
type Cashflow = { balance: number; account_id: number | null; record_date: string };

// Whole months elapsed between two YYYY-MM-DD dates (0 if `to` precedes `from`).
function monthsBetween(fromISO: string, toISO: string): number {
  const f = new Date(fromISO), t = new Date(toISO);
  if (isNaN(f.getTime()) || isNaN(t.getTime())) return 0;
  let m = (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth());
  if (t.getDate() < f.getDate()) m -= 1;
  return Math.max(0, m);
}

// Depreciation stops on the disposal date — beyond it the asset is off the
// books, so cap the "as at" date used for depreciation at the disposal date.
function depAsOf(c: Cost, asOf: string): string {
  return c.disposed_at && c.disposed_at < asOf ? c.disposed_at : asOf;
}
// Is the asset still on the balance sheet at `asOf` (not yet disposed)?
export function assetHeldAt(c: Cost, asOf: string): boolean {
  return !c.disposed_at || c.disposed_at > asOf;
}
// Accumulated straight-line depreciation on a capex asset as at a date
// (depreciation ceases at disposal).
export function assetAccumDepAt(c: Cost, asOf: string): number {
  const at = depAsOf(c, asOf);
  const months = c.depreciation_months ?? 0;
  const base = Math.max(0, c.amount - (c.residual_value ?? 0));
  if (months <= 0 || base <= 0 || c.transaction_date > at) return 0; // held at cost
  const elapsed = Math.min(monthsBetween(c.transaction_date, at), months);
  return (base / months) * elapsed;
}
// Net book value of a capex asset as at a date — zero once disposed.
export function assetNbvAt(c: Cost, asOf: string): number {
  if (c.transaction_date > asOf || !assetHeldAt(c, asOf)) return 0;
  return c.amount - assetAccumDepAt(c, asOf);
}
// Net book value written off on disposal (cost less depreciation to that date).
export function assetDisposalWriteoff(c: Cost): number {
  if (!c.disposed_at) return 0;
  return c.amount - assetAccumDepAt(c, c.disposed_at);
}
function isoDayBefore(iso: string): string {
  const d = new Date(iso); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const isCompleted = (s: string) => s === "Completed" || s === "Paid";
const isPending = (s: string) => s === "Pending";
// Accrual basis for the statutory statements: revenue is recognised when an
// invoice is ISSUED (pending or paid), so the unpaid balance sits as a
// receivable that is matched by revenue in retained earnings. (Written-off
// invoices are excluded.)
const isEarned = (s: string) => isCompleted(s) || isPending(s);

// Owner's draws / personal spend are distributions of equity, not business
// expenses: they leave the Income Statement and appear as drawings in the
// Statement of Changes in Equity.
const DRAWING_TYPES = new Set(["owner_draw", "personal"]);
const isDrawing = (c: Cost) => DRAWING_TYPES.has(c.cost_type ?? "operational");
// Charity is an expense (charge against profit), shown on its own lines.
const isSadaqah = (c: Cost) => (c.cost_type ?? "") === "sadaqah";
const isZakat = (c: Cost) => (c.cost_type ?? "") === "zakat";
// Capex = asset purchase: capitalised to PPE, not expensed in the P&L.
const isCapex = (c: Cost) => (c.cost_type ?? "") === "capex";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Financial-year date window, labelled by the calendar year in which the year
 * ENDS. `fyStartMonth` is 1-12 (SA default 3 = March start ⇒ Feb year-end).
 * A January start means the FY runs Jan–Dec of `finYear`.
 */
export function finYearRange(finYear: number, fyStartMonth: number): { start: string; end: string } {
  const m = Math.min(Math.max(Math.round(fyStartMonth || 3), 1), 12);
  if (m === 1) {
    return { start: `${finYear}-01-01`, end: `${finYear}-12-31` };
  }
  const start = `${finYear - 1}-${pad(m)}-01`;
  // Last day of the month before the start month, in finYear.
  const endD = new Date(finYear, m - 1, 0);
  const end = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`;
  return { start, end };
}

export function computeAutoFigures(opts: {
  fyStart: string;
  fyEnd: string;
  invoices: Inv[];
  costs: Cost[];
  income: Income[];
  cashflow: Cashflow[];
  intangibles: number; // R&D net book value as at fyEnd (computed by caller)
  intangiblesGross?: number; // R&D gross capitalised cost as at fyEnd (reserve)
  amortisation?: number; // R&D amortisation charged during the FY
}): AutoFigures {
  const { fyStart, fyEnd } = opts;
  const inFy = (d: string) => d >= fyStart && d <= fyEnd;
  const intangiblesGross = opts.intangiblesGross ?? opts.intangibles;
  const amortisation = opts.amortisation ?? 0;
  // Accumulated R&D amortisation to date = gross capitalised − net book value.
  const accumAmort = intangiblesGross - opts.intangibles;

  // ── PPE (purchased capex assets) — straight-line depreciation ──
  const capexCosts = opts.costs.filter((c) => isCapex(c) && c.transaction_date <= fyEnd);
  const ppe = capexCosts.reduce((s, c) => s + assetNbvAt(c, fyEnd), 0); // net book value (disposed = 0)
  const ppeAccumDepEnd = capexCosts.reduce((s, c) => s + assetAccumDepAt(c, fyEnd), 0);
  const ppeAccumDepStart = capexCosts.reduce((s, c) => s + assetAccumDepAt(c, isoDayBefore(fyStart)), 0);
  const depreciation = ppeAccumDepEnd - ppeAccumDepStart; // FY depreciation charge
  const ppeAdditions = capexCosts.filter((c) => inFy(c.transaction_date)).reduce((s, c) => s + c.amount, 0);
  // Disposals: net book value written off when an asset leaves the books.
  const disposalWriteoffFy = capexCosts
    .filter((c) => c.disposed_at && inFy(c.disposed_at))
    .reduce((s, c) => s + assetDisposalWriteoff(c), 0);
  const disposalWriteoffToDate = capexCosts
    .filter((c) => c.disposed_at && c.disposed_at <= fyEnd)
    .reduce((s, c) => s + assetDisposalWriteoff(c), 0);

  // ── Balance-sheet figures: cumulative "as at" year-end ──
  // Retained earnings excludes capex (asset, not expense) and carries the
  // accumulated R&D amortisation + PPE depreciation charged to date, plus the
  // book value of disposed assets written off (their sale proceeds are captured
  // as Other Income, so this nets the disposal down to the gain/loss).
  const retainedEarnings =
    opts.invoices.filter((i) => isEarned(i.status) && i.transaction_date <= fyEnd).reduce((s, i) => s + i.amount, 0) +
    opts.income.filter((r) => r.transaction_date <= fyEnd).reduce((s, r) => s + r.amount, 0) -
    opts.costs.filter((c) => c.transaction_date <= fyEnd && !isCapex(c)).reduce((s, c) => s + c.amount, 0) -
    accumAmort - ppeAccumDepEnd - disposalWriteoffToDate;

  const tradeReceivables = opts.invoices
    .filter((i) => isPending(i.status) && i.transaction_date <= fyEnd)
    .reduce((s, i) => s + i.amount, 0);

  // Cash = latest snapshot per account with record_date <= year-end.
  const latest: Record<string, { d: string; b: number }> = {};
  for (const r of opts.cashflow) {
    if (r.record_date > fyEnd) continue;
    const k = String(r.account_id ?? "unassigned");
    if (!latest[k] || r.record_date > latest[k].d) latest[k] = { d: r.record_date, b: r.balance };
  }
  const cash = Object.values(latest).reduce((s, x) => s + x.b, 0);

  // ── Income-statement figures: within the financial year ──
  const revenue = opts.invoices
    .filter((i) => isEarned(i.status) && inFy(i.transaction_date))
    .reduce((s, i) => s + i.amount, 0);
  const otherIncome = opts.income.filter((r) => inFy(r.transaction_date)).reduce((s, r) => s + r.amount, 0);
  const fyCosts = opts.costs.filter((c) => inFy(c.transaction_date));
  const drawings = fyCosts.filter((c) => isDrawing(c)).reduce((s, c) => s + c.amount, 0);
  const donations = fyCosts.filter((c) => isSadaqah(c)).reduce((s, c) => s + c.amount, 0);
  const zakat = fyCosts.filter((c) => isZakat(c)).reduce((s, c) => s + c.amount, 0);
  // Operating expenses exclude drawings (equity), charity (shown separately)
  // and capex (capitalised to PPE).
  const totalExpenses = fyCosts
    .filter((c) => !isDrawing(c) && !isSadaqah(c) && !isZakat(c) && !isCapex(c))
    .reduce((s, c) => s + c.amount, 0);
  const profitForYear = revenue + otherIncome - totalExpenses - donations - zakat - amortisation - depreciation - disposalWriteoffFy;

  return {
    cash,
    trade_receivables: tradeReceivables,
    intangibles: opts.intangibles,
    intangibles_gross: intangiblesGross,
    amortisation,
    depreciation,
    disposal_writeoff: disposalWriteoffFy,
    ppe,
    ppe_additions: ppeAdditions,
    retained_earnings: retainedEarnings,
    revenue,
    other_income: otherIncome,
    total_expenses: totalExpenses,
    drawings,
    donations,
    zakat,
    profit_for_year: profitForYear,
  };
}
