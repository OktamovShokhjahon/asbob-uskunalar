import { prisma } from "../../db";
import { AppError } from "../../lib/errors";
import type { AuthUser } from "../../middleware/auth";
import { PUBLIC_WHERE } from "../listings/listings.service";

type Party = { id: string; username: string; fullName: string };

export type MessageDto = { id: string; senderId: string; body: string; createdAt: string; mine: boolean };

export type ConversationDto = {
  id: string;
  listing: { id: string; title: string; icon: string; pricePerDay: number };
  /** The other person in the chat. */
  counterpart: Party;
  role: "renter" | "owner";
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
  unread: number;
  lastMessageAt: string;
};

const partySelect = { id: true, username: true, fullName: true } as const;

function lastReadOf(c: { renterId: string; renterLastReadAt: Date | null; ownerLastReadAt: Date | null }, userId: string) {
  return c.renterId === userId ? c.renterLastReadAt : c.ownerLastReadAt;
}

async function unreadIn(conversationId: string, userId: string, lastRead: Date | null) {
  return prisma.message.count({
    where: { conversationId, senderId: { not: userId }, ...(lastRead ? { createdAt: { gt: lastRead } } : {}) },
  });
}

/** First message to an eʼlon owner: reuses the chat for (eʼlon, renter) if it exists. */
export async function startConversation(listingId: string, renter: AuthUser, body: string): Promise<{ id: string }> {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId.trim().toUpperCase(), ...PUBLIC_WHERE },
    select: { id: true, ownerId: true },
  });
  if (!listing || !listing.ownerId) throw new AppError(404, "LISTING_NOT_FOUND");
  if (listing.ownerId === renter.id) throw new AppError(400, "CANNOT_MESSAGE_SELF");

  const now = new Date();
  const conversation = await prisma.conversation.upsert({
    where: { listingId_renterId: { listingId: listing.id, renterId: renter.id } },
    update: { lastMessageAt: now, renterLastReadAt: now },
    create: {
      listingId: listing.id,
      renterId: renter.id,
      ownerId: listing.ownerId,
      lastMessageAt: now,
      renterLastReadAt: now,
    },
  });
  await prisma.message.create({ data: { conversationId: conversation.id, senderId: renter.id, body } });
  return { id: conversation.id };
}

async function getParticipating(id: string, userId: string) {
  const c = await prisma.conversation.findUnique({
    where: { id },
    include: {
      listing: { select: { id: true, title: true, icon: true, pricePerDay: true } },
      renter: { select: partySelect },
      owner: { select: partySelect },
    },
  });
  if (!c || (c.renterId !== userId && c.ownerId !== userId)) throw new AppError(404, "CONVERSATION_NOT_FOUND");
  return c;
}

export async function listConversations(userId: string): Promise<ConversationDto[]> {
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ renterId: userId }, { ownerId: userId }] },
    include: {
      listing: { select: { id: true, title: true, icon: true, pricePerDay: true } },
      renter: { select: partySelect },
      owner: { select: partySelect },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  return Promise.all(
    rows.map(async (c) => {
      const role = c.renterId === userId ? "renter" : "owner";
      const last = c.messages[0];
      return {
        id: c.id,
        listing: c.listing,
        counterpart: role === "renter" ? c.owner : c.renter,
        role,
        lastMessage: last
          ? { body: last.body, createdAt: last.createdAt.toISOString(), mine: last.senderId === userId }
          : null,
        unread: await unreadIn(c.id, userId, lastReadOf(c, userId)),
        lastMessageAt: c.lastMessageAt.toISOString(),
      } satisfies ConversationDto;
    }),
  );
}

/** Messages (optionally only newer than `after`), and marks the chat as read for this user. */
export async function getConversation(id: string, userId: string, after?: Date) {
  const c = await getParticipating(id, userId);
  const role = c.renterId === userId ? "renter" : "owner";
  const messages = await prisma.message.findMany({
    where: { conversationId: c.id, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  await prisma.conversation.update({
    where: { id: c.id },
    data: role === "renter" ? { renterLastReadAt: new Date() } : { ownerLastReadAt: new Date() },
  });
  return {
    id: c.id,
    listing: c.listing,
    counterpart: role === "renter" ? c.owner : c.renter,
    role,
    messages: messages.map(
      (m): MessageDto => ({
        id: m.id,
        senderId: m.senderId,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        mine: m.senderId === userId,
      }),
    ),
  };
}

export async function sendMessage(id: string, userId: string, body: string): Promise<MessageDto> {
  const c = await getParticipating(id, userId);
  const now = new Date();
  const [m] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId: c.id, senderId: userId, body } }),
    prisma.conversation.update({
      where: { id: c.id },
      data: {
        lastMessageAt: now,
        ...(c.renterId === userId ? { renterLastReadAt: now } : { ownerLastReadAt: now }),
      },
    }),
  ]);
  return { id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt.toISOString(), mine: true };
}

export async function unreadMessageCount(userId: string): Promise<number> {
  const convs = await prisma.conversation.findMany({
    where: { OR: [{ renterId: userId }, { ownerId: userId }] },
    select: { id: true, renterId: true, renterLastReadAt: true, ownerLastReadAt: true },
  });
  const counts = await Promise.all(convs.map((c) => unreadIn(c.id, userId, lastReadOf(c, userId))));
  return counts.reduce((a, b) => a + b, 0);
}
