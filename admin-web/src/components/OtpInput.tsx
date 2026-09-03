"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

const OTP_LENGTH = 6;

export function OtpInput({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, index) => value[index] || "");

  const updateAtIndex = useCallback(
    (index: number, digit: string) => {
      const chars = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || "");
      chars[index] = digit;
      onChange(chars.join("").slice(0, OTP_LENGTH));
    },
    [onChange, value],
  );

  const focusIndex = useCallback((index: number) => {
    const target = inputRefs.current[index];
    if (target) {
      target.focus();
      target.select();
    }
  }, []);

  useEffect(() => {
    if (!value && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [value]);

  const applyDigits = (raw: string, startIndex = 0) => {
    const normalized = raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!normalized) {
      return;
    }
    const chars = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || "");
    for (let offset = 0; offset < normalized.length; offset += 1) {
      const targetIndex = startIndex + offset;
      if (targetIndex >= OTP_LENGTH) {
        break;
      }
      chars[targetIndex] = normalized[offset] || "";
    }
    const next = chars.join("").slice(0, OTP_LENGTH);
    onChange(next);
    const nextFocus = Math.min(startIndex + normalized.length, OTP_LENGTH - 1);
    focusIndex(nextFocus);
  };

  const handleInput = (index: number, nextValue: string) => {
    const digit = nextValue.replace(/\D/g, "").slice(-1);
    updateAtIndex(index, digit);
    if (digit && index < OTP_LENGTH - 1) {
      focusIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      updateAtIndex(index - 1, "");
      focusIndex(index - 1);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      focusIndex(index - 1);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      focusIndex(index + 1);
      event.preventDefault();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    applyDigits(event.clipboardData.getData("text"));
  };

  return (
    <div className="flex items-center justify-between gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          className="h-12 w-11 rounded-xl border border-[var(--lxxl-border)] text-center text-lg font-semibold tracking-[0.2em] outline-none ring-[var(--lxxl-green)] focus:ring-2 disabled:opacity-60 sm:h-14 sm:w-12"
          disabled={disabled}
          inputMode="numeric"
          maxLength={1}
          type="text"
          value={digit}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}

export function isOtpComplete(value: string) {
  return /^\d{6}$/.test(value);
}
