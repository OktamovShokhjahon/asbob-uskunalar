"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getPublicListing } from "@/lib/api";
import type { Listing } from "@/lib/types";

/**
 * Loads the approved eʼlon from the [id] route segment.
 * listing: undefined = loading, null = not found.
 */
export function useRouteListing() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setListing(undefined);
    setError(undefined);
    getPublicListing(id)
      .then((l) => alive && setListing(l))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Kutilmagan xatolik"));
    return () => {
      alive = false;
    };
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { listing, error, retry };
}
