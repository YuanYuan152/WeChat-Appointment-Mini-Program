export interface ThreePartySharePreview {
  displayPriceYuan: number;
  counselorShareYuan: number;
  platformShareYuan: number;
  hospitalShareYuan: number;
  counselorSharePercent: number;
  platformSharePercent: number;
  hospitalSharePercent: number;
}

export function buildCounselorPercentPricingUpdate(
  basePriceYuan: number,
  defaultRevenueSharePercent: number,
) {
  return {
    basePriceYuan,
    defaultRevenueSharePercent,
  };
}

export function parseIntegerDraft(value: string): number | null {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function isIntegerDraft(value: string, allowNegative = true) {
  return (allowNegative ? /^-?\d*$/ : /^\d*$/).test(value);
}

export function normalizeIntegerDraft(value: string) {
  const parsed = parseIntegerDraft(value);
  return parsed == null ? value : String(parsed);
}

export function calculateThreePartyShare(
  displayPriceYuan: number,
  counselorSharePercent: number,
  hospitalSharePercent = 0,
): ThreePartySharePreview {
  const display = Math.max(0, Math.floor(displayPriceYuan));
  const hospitalPercent = clampPercent(hospitalSharePercent);
  const counselorPercent = Math.min(
    clampPercent(counselorSharePercent),
    100 - hospitalPercent,
  );
  const hospitalShareYuan = Math.floor((display * hospitalPercent) / 100);
  const counselorShareYuan = Math.min(
    display - hospitalShareYuan,
    Math.floor((display * counselorPercent) / 100),
  );
  const platformShareYuan = Math.max(
    0,
    display - counselorShareYuan - hospitalShareYuan,
  );

  return {
    displayPriceYuan: display,
    counselorShareYuan,
    platformShareYuan,
    hospitalShareYuan,
    counselorSharePercent: counselorPercent,
    platformSharePercent: percentOf(platformShareYuan, display),
    hospitalSharePercent: hospitalPercent,
  };
}

export function calculateThreePartyShareFromCents(
  displayPriceCents: number,
  counselorShareCents: number,
  hospitalShareCents = 0,
) {
  const display = Math.max(0, Math.floor(displayPriceCents));
  const hospital = Math.min(display, Math.max(0, Math.floor(hospitalShareCents)));
  const counselor = Math.min(
    display - hospital,
    Math.max(0, Math.floor(counselorShareCents)),
  );
  const platform = Math.max(0, display - counselor - hospital);
  return {
    displayPriceCents: display,
    counselorShareCents: counselor,
    platformShareCents: platform,
    hospitalShareCents: hospital,
    counselorSharePercent: percentOf(counselor, display),
    platformSharePercent: percentOf(platform, display),
    hospitalSharePercent: percentOf(hospital, display),
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(Math.floor(value), 100));
}

function percentOf(amount: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.round((amount * 10_000) / total) / 100;
}
