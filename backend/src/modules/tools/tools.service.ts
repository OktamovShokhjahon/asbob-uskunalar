import type { Listing } from "@prisma/client";
import { AppError, fieldError } from "../../lib/errors";
import { getApproved, listApproved } from "../listings/listings.service";

/**
 * The original task API (backend-tz.md §6.2–6.3): approved listings in the
 * simple tool shape. The six seeded tools come first, then approved user eʼlonlar.
 */
export type ToolDto = { id: string; name: string; description: string; pricePerDay: number; icon: string };

export function toToolDto(l: Listing): ToolDto {
  return { id: l.id, name: l.title, description: l.description, pricePerDay: l.pricePerDay, icon: l.icon };
}

export async function listTools(q?: string): Promise<ToolDto[]> {
  return (await listApproved(q)).map(toToolDto);
}

/** Only approved listings can be quoted or rented. 404 TOOL_NOT_FOUND otherwise. */
export async function getToolOrThrow(id: string): Promise<Listing> {
  const tool = await getApproved(id);
  if (!tool) throw new AppError(404, "TOOL_NOT_FOUND", { toolId: fieldError("TOOL_NOT_FOUND") });
  return tool;
}
