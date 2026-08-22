"use client";

import { useEffect } from "react";

import {
  saveOfflineSnapshot,
  type OfflineSnapshot,
} from "@/lib/pwa/offline-snapshot";

export function OfflineSnapshotWriter({
  snapshot,
}: {
  snapshot: OfflineSnapshot;
}) {
  useEffect(() => {
    void saveOfflineSnapshot(snapshot);
  }, [snapshot]);

  return null;
}
