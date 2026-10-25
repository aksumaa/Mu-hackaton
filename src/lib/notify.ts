import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export async function notifyUser(input: {
  userId: string;
  type: string;
  titleKey: string;
  payload?: Record<string, string | number | boolean | null>;
}) {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      titleKey: input.titleKey,
      payload: input.payload ?? {},
    },
  });

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return;
  if (user.email && process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: "MU Hackathon",
      text: `${input.titleKey}\n${JSON.stringify(input.payload ?? {})}`,
    }).catch(() => undefined);
  }
  if (user.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: user.telegramChatId,
        text: `MU Hackathon: ${input.titleKey}`,
      }),
    }).catch(() => undefined);
  }
}
