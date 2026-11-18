import { prisma } from "../../db";

export type NotificationType =
  | "listing_approved"
  | "listing_rejected"
  | "listing_hidden"
  | "rental_request"
  | "rental_approved"
  | "rental_declined";

export type NotificationDto = {
  id: string;
  type: NotificationType;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
};

/** Stores type + data; the client renders the text in its own language. */
export async function notify(userId: string, type: NotificationType, data: Record<string, unknown>) {
  await prisma.notification.create({ data: { userId, type, data: JSON.stringify(data) } });
}

export async function listNotifications(userId: string, take = 50): Promise<NotificationDto[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((n) => {
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(n.data);
    } catch {
      /* keep empty */
    }
    return {
      id: n.id,
      type: n.type as NotificationType,
      data,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    };
  });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

export function unreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
