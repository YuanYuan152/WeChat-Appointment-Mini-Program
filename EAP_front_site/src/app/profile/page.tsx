import { PageHero } from "@/components/layout/page-hero";
import { ProfileClient } from "@/components/auth/profile-client";

export default function ProfilePage() {
  return (
    <>
      <PageHero title="个人中心" subtitle="管理您的预约、消息与账号信息" />
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <ProfileClient />
      </section>
    </>
  );
}
