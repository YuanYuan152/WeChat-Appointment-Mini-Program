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

export function clampSharePercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(Math.round(value), 100));
}

export function clampShareYuan(value: number, displayYuan: number) {
  const display = Math.max(0, Math.floor(displayYuan));
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(Math.floor(value), display));
}

export function shareYuanFromPercent(percent: number, displayYuan: number) {
  const display = Math.max(0, Math.floor(displayYuan));
  return clampShareYuan(Math.floor((display * clampSharePercent(percent)) / 100), display);
}

export function sharePercentFromYuan(amountYuan: number, displayYuan: number) {
  const display = Math.max(0, Math.floor(displayYuan));
  if (display <= 0) {
    return 0;
  }
  return clampSharePercent(Math.round((clampShareYuan(amountYuan, display) * 100) / display));
}

/** 按咨询师分成金额锁定，医院金额锁定，平台取余额（与小程序一致）。 */
export function threePartyFromCounselorAmount(
  displayPriceYuan: number,
  counselorShareYuan: number,
  hospitalShareYuan = 0,
): ThreePartySharePreview {
  const display = Math.max(0, Math.floor(displayPriceYuan));
  const hospital = clampShareYuan(hospitalShareYuan, display);
  const counselor = clampShareYuan(counselorShareYuan, display - hospital);
  const platform = Math.max(0, display - counselor - hospital);
  return {
    displayPriceYuan: display,
    counselorShareYuan: counselor,
    platformShareYuan: platform,
    hospitalShareYuan: hospital,
    counselorSharePercent: percentOf(counselor, display),
    platformSharePercent: percentOf(platform, display),
    hospitalSharePercent: percentOf(hospital, display),
  };
}

/** 按平台分成金额锁定，医院金额锁定，咨询师取余额。 */
export function threePartyFromPlatformAmount(
  displayPriceYuan: number,
  platformShareYuan: number,
  hospitalShareYuan = 0,
): ThreePartySharePreview {
  const display = Math.max(0, Math.floor(displayPriceYuan));
  const hospital = clampShareYuan(hospitalShareYuan, display);
  const platform = clampShareYuan(platformShareYuan, display - hospital);
  const counselor = Math.max(0, display - platform - hospital);
  return {
    displayPriceYuan: display,
    counselorShareYuan: counselor,
    platformShareYuan: platform,
    hospitalShareYuan: hospital,
    counselorSharePercent: percentOf(counselor, display),
    platformSharePercent: percentOf(platform, display),
    hospitalSharePercent: percentOf(hospital, display),
  };
}

/** 按医院分成金额锁定，咨询师金额锁定，平台取余额。 */
export function threePartyFromHospitalAmount(
  displayPriceYuan: number,
  hospitalShareYuan: number,
  counselorShareYuan: number,
): ThreePartySharePreview {
  const display = Math.max(0, Math.floor(displayPriceYuan));
  const hospital = clampShareYuan(hospitalShareYuan, display);
  const counselor = clampShareYuan(counselorShareYuan, display - hospital);
  const platform = Math.max(0, display - counselor - hospital);
  return {
    displayPriceYuan: display,
    counselorShareYuan: counselor,
    platformShareYuan: platform,
    hospitalShareYuan: hospital,
    counselorSharePercent: percentOf(counselor, display),
    platformSharePercent: percentOf(platform, display),
    hospitalSharePercent: percentOf(hospital, display),
  };
}

export function calculateThreePartyShare(
  displayPriceYuan: number,
  counselorSharePercent: number,
  hospitalSharePercent = 0,
): ThreePartySharePreview {
  const display = Math.max(0, Math.floor(displayPriceYuan));
  const hospitalPercent = clampSharePercent(hospitalSharePercent);
  const counselorPercent = Math.min(
    clampSharePercent(counselorSharePercent),
    100 - hospitalPercent,
  );
  const hospitalShareYuan = Math.floor((display * hospitalPercent) / 100);
  const counselorShareYuan = Math.min(
    display - hospitalShareYuan,
    Math.floor((display * counselorPercent) / 100),
  );
  return threePartyFromCounselorAmount(display, counselorShareYuan, hospitalShareYuan);
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

function percentOf(amount: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.round((amount * 10_000) / total) / 100;
}
