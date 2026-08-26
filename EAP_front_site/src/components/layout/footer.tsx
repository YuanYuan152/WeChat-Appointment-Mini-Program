import Link from "next/link";
import Image from "next/image";
import { Heart, Phone } from "lucide-react";
import { ASSISTANT_CONTACT } from "@/lib/booking/contact-info";

export function Footer() {
  const assistant = ASSISTANT_CONTACT;

  return (
    <footer className="mt-auto border-t border-border bg-card/50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <span className="font-serif text-lg font-semibold">连心心理</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              专业心理咨询机构，用温暖和专业陪伴每一段心灵旅程。
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-serif font-semibold">快速导航</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="/stories" className="hover:text-primary">心理图文</Link>
              <Link href="/qa" className="hover:text-primary">心理问答</Link>
              <Link href="/our-stories" className="hover:text-primary">我们的故事</Link>
              <Link href="/audio" className="hover:text-primary">心理音画</Link>
              <Link href="/consultation" className="hover:text-primary">预约咨询</Link>
              <Link href="/assessment" className="hover:text-primary">心理测评</Link>
            </div>
          </div>

          <div>
            <h4 className="mb-4 font-serif font-semibold">联系我们</h4>
            <div className="flex flex-col gap-4 text-sm text-muted-foreground">
              <a
                href={`tel:${assistant.phoneDial}`}
                className="flex items-center gap-2 transition-colors hover:text-primary"
              >
                <Phone className="h-4 w-4 shrink-0" />
                {assistant.phone}
              </a>
              <div className="flex items-start gap-3">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                  <Image
                    src={assistant.qrcodeSrc}
                    alt="咨询助理微信二维码"
                    width={96}
                    height={96}
                    className="object-contain"
                  />
                </div>
                <div className="min-w-0 pt-1">
                  <p className="font-medium text-foreground">微信扫码联系助理</p>
                  <p className="mt-1 text-xs leading-5">{assistant.hint}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8 text-center text-xs text-muted-foreground">
          <p>© 2026 连心心理咨询中心 · 测评结果仅供参考，不能替代专业诊断</p>
        </div>
      </div>
    </footer>
  );
}
