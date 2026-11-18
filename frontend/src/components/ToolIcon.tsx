import type { IconKind } from "@/lib/types";

type Props = { kind: IconKind; className?: string };

/** Hand-drawn line icons, one per eʼlon type. */
export function ToolIcon({ kind, className }: Props) {
  const common = {
    viewBox: "0 0 64 64",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (kind) {
    case "drill": // Drel
      return (
        <svg {...common}>
          <path d="M10 18h30a6 6 0 0 1 6 6v2a6 6 0 0 1-6 6H22" />
          <path d="M46 22h6l6 3-6 3h-6" />
          <path d="M22 32l-4 20h12l3-20" />
          <path d="M18 44h14" />
          <path d="M10 18v14h12" />
          <path d="M27 24h10" />
        </svg>
      );
    case "ladder": // Narvon
      return (
        <svg {...common}>
          <path d="M20 6l-8 52" />
          <path d="M44 6l8 52" />
          <path d="M19 14h26" />
          <path d="M17 26h30" />
          <path d="M15.5 38h33" />
          <path d="M14 50h36" />
        </svg>
      );
    case "projector": // Proyektor
      return (
        <svg {...common}>
          <rect x="6" y="24" width="36" height="20" rx="4" />
          <circle cx="32" cy="34" r="6" />
          <path d="M38 30l20-12M38 38l20 12" strokeDasharray="3 4" />
          <path d="M12 44v6M36 44v6" />
          <path d="M12 30h8" />
        </svg>
      );
    case "mic": // Mikrofon
      return (
        <svg {...common}>
          <rect x="24" y="6" width="16" height="28" rx="8" />
          <path d="M24 16h6M24 22h6" />
          <path d="M16 28a16 16 0 0 0 32 0" />
          <path d="M32 44v10" />
          <path d="M22 58h20" />
        </svg>
      );
    case "sewing": // Tikuv mashinasi
      return (
        <svg {...common}>
          <path d="M8 50h48" />
          <path d="M12 50V22a8 8 0 0 1 8-8h28a6 6 0 0 1 6 6v8H26v22" />
          <path d="M44 28v10" />
          <path d="M42 38h4" />
          <path d="M44 42v2" strokeDasharray="1 3" />
          <circle cx="50" cy="20" r="2" />
          <path d="M20 22v6" />
        </svg>
      );
    case "vacuum": // Gilam tozalagich
      return (
        <svg {...common}>
          <path d="M38 6l-6 34" />
          <path d="M34 6h10" />
          <path d="M18 40h22a6 6 0 0 1 6 6v2H12v-2a6 6 0 0 1 6-6z" />
          <circle cx="18" cy="54" r="3" />
          <circle cx="40" cy="54" r="3" />
          <path d="M4 58h8M48 58h12" strokeDasharray="2 4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          {/* toolbox */}
          <rect x="6" y="24" width="52" height="28" rx="3" />
          <path d="M24 24v-8h16v8" />
          <path d="M6 36h52" />
          <path d="M28 32v8h8v-8" />
        </svg>
      );
  }
}
