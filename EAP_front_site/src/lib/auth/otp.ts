/** 短信验证码位数（与后端 SMS_CODE_LENGTH 默认值一致）。 */
export const OTP_LENGTH = 6;

const FULLWIDTH_DIGITS = /[０-９]/g;
const COMPLETE_OTP = new RegExp(`^\\d{${OTP_LENGTH}}$`);
// 不用后行断言（?<!），旧版 iOS Safari 不支持，会让整个模块解析失败。
const STANDALONE_OTP = new RegExp(`(?:^|\\D)(\\d{${OTP_LENGTH}})(?!\\d)`);

function toHalfWidthDigits(raw: string): string {
  return raw.replace(FULLWIDTH_DIGITS, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/** 只保留数字；输入法全角模式下打出的数字（０-９）按半角处理。 */
export function extractOtpDigits(raw: string): string {
  return toHalfWidthDigits(raw).replace(/\D/g, "");
}

/**
 * 从粘贴内容中取验证码：粘贴整条短信（如“验证码 123456，5 分钟内有效”）时
 * 优先取独立出现的 6 位数字，否则按顺序取前 6 位数字。
 */
export function pickOtpFromText(raw: string): string {
  const text = toHalfWidthDigits(raw);
  const standalone = text.match(STANDALONE_OTP);
  if (standalone) {
    return standalone[1];
  }
  return extractOtpDigits(text).slice(0, OTP_LENGTH);
}

/**
 * 根据输入框的新内容计算验证码。
 *
 * 输入框的光标始终保持在末尾，新输入总是追加在已有数字之后。若追加后超过
 * 6 位，说明是短信验证码自动填充或输入法一次上屏了一整段数字，此时以新插入
 * 的那一段为准，而不是把它截掉。
 */
export function nextOtpValue(previous: string, rawInput: string): string {
  const next = extractOtpDigits(rawInput);
  if (next.length <= OTP_LENGTH) {
    return next;
  }
  const inserted = next.startsWith(previous) ? next.slice(previous.length) : next;
  return (inserted.length >= OTP_LENGTH ? inserted : next).slice(0, OTP_LENGTH);
}

export function isOtpComplete(value: string): boolean {
  return COMPLETE_OTP.test(value);
}
