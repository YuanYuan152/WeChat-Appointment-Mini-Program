import Link from "next/link";

type CaseRecordsView = "records" | "amendments";

const activeClass =
  "inline-flex h-10 items-center rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)]";
const inactiveClass =
  "inline-flex h-10 items-center rounded-xl border border-[var(--lxxl-border)] bg-white px-4 text-sm font-medium text-[var(--lxxl-text)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]";

export function CaseRecordsViewSwitch({ active }: { active: CaseRecordsView }) {
  return (
    <div className="flex shrink-0 flex-wrap gap-3">
      <Link href="/case-records" className={active === "records" ? activeClass : inactiveClass}>
        咨询记录
      </Link>
      <Link
        href="/case-records/amendments"
        className={active === "amendments" ? activeClass : inactiveClass}
      >
        咨询记录审核
      </Link>
    </div>
  );
}
