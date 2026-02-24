"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WorkflowRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/board/${id}`);
  }, [router, id]);

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="text-gray-400">Redirecting...</div>
    </div>
  );
}
