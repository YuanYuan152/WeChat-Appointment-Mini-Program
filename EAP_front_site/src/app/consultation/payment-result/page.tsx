import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentResultPageProps {
  searchParams: Promise<{ order_id?: string }>;
}

export default async function PaymentResultPage({ searchParams }: PaymentResultPageProps) {
  const { order_id } = await searchParams;

  return (
    <section className="flex min-h-[60vh] items-center justify-center px-4 pb-16 pt-28">
      <div className="w-full max-w-md rounded-[var(--radius)] border border-border bg-card p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
        <h1 className="mt-4 font-serif text-2xl font-bold">预约成功</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          您的咨询预约已确认
          {order_id ? `（订单号 ${order_id}）` : ""}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/consultation/records" className="flex-1">
            <Button variant="outline" className="w-full">查看预约记录</Button>
          </Link>
          <Link href="/consultation" className="flex-1">
            <Button className="w-full">继续浏览咨询师</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
