export function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const ROLLING_SCHEDULE_WINDOW_DAYS = 30;

export function addLocalDays(dateValue: string, days: number) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!matched) {
    return dateValue;
  }
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
  date.setDate(date.getDate() + days);
  return getLocalDateValue(date);
}

export function getRollingScheduleMaxDateValue() {
  return addLocalDays(getLocalDateValue(), ROLLING_SCHEDULE_WINDOW_DAYS - 1);
}
