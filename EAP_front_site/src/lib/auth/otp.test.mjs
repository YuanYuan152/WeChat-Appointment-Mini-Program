import assert from "node:assert/strict";
import test from "node:test";

import {
  extractOtpDigits,
  isOtpComplete,
  nextOtpValue,
  pickOtpFromText,
} from "./otp.ts";

test("keeps digits typed one by one", () => {
  let value = "";
  for (const digit of "946898") {
    value = nextOtpValue(value, value + digit);
  }
  assert.equal(value, "946898");
  assert.equal(isOtpComplete(value), true);
});

test("accepts a whole code inserted at once (SMS autofill / IME commit)", () => {
  assert.equal(nextOtpValue("", "946898"), "946898");
  // 已输入部分数字后，系统把完整验证码追加在后面：以新插入的验证码为准
  assert.equal(nextOtpValue("12", "12946898"), "946898");
});

test("ignores extra digits once the code is full", () => {
  assert.equal(nextOtpValue("123456", "1234567"), "123456");
  assert.equal(nextOtpValue("12345", "1234567"), "123456");
});

test("backspace removes the last digit", () => {
  assert.equal(nextOtpValue("123456", "12345"), "12345");
  assert.equal(nextOtpValue("1", ""), "");
});

test("normalizes full-width digits and drops other characters", () => {
  assert.equal(extractOtpDigits("９４６ ８９８"), "946898");
  assert.equal(nextOtpValue("", "９４６８９８"), "946898");
  assert.equal(nextOtpValue("", "a1-2"), "12");
});

test("picks the code out of a pasted SMS", () => {
  assert.equal(pickOtpFromText("【连心心理】验证码 946898，5分钟内有效"), "946898");
  assert.equal(pickOtpFromText("您的验证码为：９４６８９８"), "946898");
  assert.equal(pickOtpFromText(" 946898 "), "946898");
  assert.equal(pickOtpFromText("94 68 98"), "946898");
  assert.equal(pickOtpFromText("12"), "12");
  assert.equal(pickOtpFromText("没有数字"), "");
});

test("only six ASCII digits count as complete", () => {
  assert.equal(isOtpComplete("946898"), true);
  assert.equal(isOtpComplete("94689"), false);
  assert.equal(isOtpComplete("9468981"), false);
  assert.equal(isOtpComplete("94 898"), false);
});
