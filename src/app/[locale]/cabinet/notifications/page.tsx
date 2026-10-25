import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge, Card, Empty } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/session";
import { formatTashkent } from "@/lib/time";
import { markNotification } from "@/server/participant-actions";
import { asString, asRecord } from "@/server/content";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRoles(locale, ["PARTICIPANT"]);
  const t = await getTranslations();
  const rows = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  if (rows.length === 0) return <Empty>{t("cabinet.noNotifications")}</Empty>;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t("cabinet.notifications")}</h1>
        <form action={markNotification}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value="all" />
          <button type="submit" className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold">{t("cabinet.markAll")}</button>
        </form>
      </div>
      {rows.map((row) => {
        const payload = asRecord(row.payload);
        const key = row.titleKey.startsWith("notifications.") ? row.titleKey : "notifications.reminder";
        return (
          <Card key={row.id}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{t(key as "notifications.published")}</p>
              {!row.readAt ? <Badge>{t("cabinet.unread")}</Badge> : null}
            </div>
            {asString(payload.note) ? <p className="mt-2 break-words text-sm">{asString(payload.note)}</p> : null}
            <p className="mt-2 text-xs text-muted tabular-nums">{formatTashkent(row.createdAt)}</p>
            {!row.readAt ? (
              <form action={markNotification} className="mt-3">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={row.id} />
                <button type="submit" className="min-h-11 text-sm font-semibold underline">{t("cabinet.markRead")}</button>
              </form>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
