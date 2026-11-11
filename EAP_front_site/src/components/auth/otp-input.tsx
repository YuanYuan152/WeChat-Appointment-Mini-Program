"use client";

import {
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type Ref,
  type SyntheticEvent,
} from "react";

import {
  OTP_LENGTH,
  extractOtpDigits,
  isOtpComplete,
  nextOtpValue,
  pickOtpFromText,
} from "@/lib/auth/otp";
import { cn } from "@/lib/utils";

export { isOtpComplete, OTP_LENGTH };

/** 光标固定在末尾（整段全选除外），避免在中间插入/删除导致数字错位。 */
function keepCaretAtEnd(input: HTMLInputElement) {
  const end = input.value.length;
  const { selectionStart, selectionEnd } = input;
  if (selectionStart === null || selectionEnd === null) {
    return;
  }
  const selectsAll = selectionStart === 0 && selectionEnd === end;
  if (!selectsAll && (selectionStart !== end || selectionEnd !== end)) {
    input.setSelectionRange(end, end);
  }
}

/**
 * 6 位短信验证码输入。
 *
 * 由一个透明的真实 <input> 覆盖在 6 个展示格子上承接全部输入：短信验证码
 * 自动填充、输入法整段上屏、粘贴、拖放都能完整写入；不再是“每格一个
 * maxLength=1 的输入框”，那种写法整段插入时只进第一位，改错时数字会错位。
 */
export function OtpInput({
  value,
  onChange,
  disabled = false,
  className,
  id,
  ref,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  ref?: Ref<HTMLInputElement>;
}) {
  const [focused, setFocused] = useState(false);
  const digits = extractOtpDigits(value).slice(0, OTP_LENGTH);
  const activeIndex = Math.min(digits.length, OTP_LENGTH - 1);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(nextOtpValue(digits, event.target.value));
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = pickOtpFromText(event.clipboardData.getData("text"));
    if (!pasted) {
      return;
    }
    const input = event.currentTarget;
    const replacesAll =
      pasted.length >= OTP_LENGTH
      || (input.selectionStart === 0 && input.selectionEnd === input.value.length);
    onChange(((replacesAll ? "" : digits) + pasted).slice(0, OTP_LENGTH));
  };

  const handleSelect = (event: SyntheticEvent<HTMLInputElement>) => {
    keepCaretAtEnd(event.currentTarget);
  };

  return (
    <div className={cn("relative", className)}>
      <div aria-hidden="true" className="flex items-center justify-between gap-2">
        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const active = focused && index === activeIndex;
          return (
            <div
              key={index}
              className={cn(
                "flex h-12 w-11 items-center justify-center rounded-xl border border-border bg-background text-lg font-semibold transition-shadow sm:h-14 sm:w-12",
                active && "ring-2 ring-primary",
                disabled && "opacity-60",
              )}
            >
              {digits[index] ?? (active ? (
                <span className="h-5 w-px animate-pulse bg-foreground" />
              ) : null)}
            </div>
          );
        })}
      </div>
      <input
        ref={ref}
        id={id}
        autoComplete="one-time-code"
        className="absolute inset-0 h-full w-full cursor-text border-0 bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent disabled:cursor-not-allowed [-webkit-text-fill-color:transparent]"
        disabled={disabled}
        inputMode="numeric"
        spellCheck={false}
        type="text"
        value={digits}
        onBlur={() => setFocused(false)}
        onChange={handleChange}
        onFocus={(event) => {
          setFocused(true);
          keepCaretAtEnd(event.currentTarget);
        }}
        onPaste={handlePaste}
        onSelect={handleSelect}
      />
    </div>
  );
}
