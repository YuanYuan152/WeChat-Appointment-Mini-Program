import type { ReactNode } from "react";

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--lxxl-border)] px-6 py-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-[var(--lxxl-muted)]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="px-6 py-10 text-center text-sm text-[var(--lxxl-muted)]">{text}</div>;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "gold" | "red";
}) {
  const styles = {
    neutral: "bg-[#F4F1EB] text-[var(--lxxl-text)]",
    green: "bg-[#EAF2ED] text-[var(--lxxl-green-dark)]",
    gold: "bg-[#FBF3DF] text-[#967342]",
    red: "bg-[#FBE8E6] text-[#B34B43]",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#FAF8F4] p-3">
      <div className="text-xs text-[var(--lxxl-muted)]">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

export function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold">{title}</h4>
      {items.length === 0 ? (
        <div className="mt-3 text-sm text-[var(--lxxl-muted)]">暂无记录</div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <div
              key={`${title}-${index}`}
              className="rounded-xl bg-[#FAF8F4] p-3 text-xs leading-5 text-[var(--lxxl-muted)]"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
