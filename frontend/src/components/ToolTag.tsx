import Link from "next/link";
import type { CSSProperties } from "react";
import { groupDigits } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { PhotoCarousel } from "./PhotoCarousel";

export type TagData = Pick<Listing, "id" | "title" | "description" | "pricePerDay" | "icon"> & {
  ownerUsername?: string;
  photos?: string[];
};

type Props = {
  tool: TagData;
  /** When set, the whole card links there (a stretched link, so the carousel buttons still work). */
  href?: string;
  tilt?: number;
  large?: boolean;
  /** Cards alternate ink and surface, like a dealt hand. */
  tone?: "ink" | "surface";
  index?: number;
  /** Show the photo carousel on top of the card (off on the tool page, which has its own). */
  media?: boolean;
};

export function ToolTag({ tool, href, tilt = 0, large = false, tone = "surface", index = 0, media = true }: Props) {
  const style = { "--tilt": `${tilt}deg`, "--i": index } as CSSProperties;
  const byUser = tool.ownerUsername && tool.ownerUsername !== "admin";
  const price = tool.pricePerDay > 0 ? groupDigits(tool.pricePerDay) : "—";

  return (
    <div className={`deal ${href ? "deal-hover" : ""}`} style={style}>
      <div className={`card ${tone === "ink" ? "card-ink" : ""} ${large ? "!p-8 sm:!p-10" : ""}`}>
        {media && (
          <div className="card-media">
            <PhotoCarousel photos={tool.photos ?? []} alt={tool.title || "Asbob"} icon={tool.icon} tone={tone} />
          </div>
        )}

        <p className="flex items-center justify-between gap-3 text-small opacity-80">
          <span className="font-semibold">{tool.id}</span>
          <span className="truncate">{byUser ? `@${tool.ownerUsername}` : "Kunbay ijara"}</span>
        </p>

        <h3 className={`font-display mt-4 break-words ${large ? "text-head" : "text-sub"}`}>
          {href ? (
            <Link
              href={href}
              className="deal-link"
              aria-label={`${tool.title}, ${tool.description}, kuniga ${price} soʻm. Tanlash`}
            >
              {tool.title || "Asbob nomi"}
            </Link>
          ) : (
            tool.title || "Asbob nomi"
          )}
        </h3>
        <p className="mt-3 break-words opacity-85">{tool.description || "Qisqa tavsif"}</p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-8">
          <p className="leading-tight">
            <span className="font-display block text-[1.35rem]">{price}</span>
            <span className="text-small opacity-80">soʻm / kun</span>
          </p>
          {href && (
            <span className="btn btn-sm" aria-hidden>
              Tanlash <span className="arrow">→</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
