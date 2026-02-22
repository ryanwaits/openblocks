"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const id = crypto.randomUUID();
    router.replace(`/workflow/${id}`);
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="text-[var(--color-muted)]">Loading...</div>
    </div>
  );
}
