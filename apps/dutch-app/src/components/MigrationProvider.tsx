"use client";

import { useAuth } from "@myorg/auth-google";
import { useEffect } from "react";
import { migrateLocalStorageToPocketBase } from "@/lib/migration";
import { migrateOldNotes } from "@/lib/storage";

export function MigrationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    migrateOldNotes(); // Migrates old localStorage notes format (runs once, idempotent)

    if (user?.uid) {
      migrateLocalStorageToPocketBase(user.uid);
    }
  }, [user?.uid]);

  return <>{children}</>;
}
