"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { fetchBoards, type Board } from "@/lib/supabase/boards";
import { NameDialog } from "@/components/auth/name-dialog";
import { BoardCard } from "@/components/boards/board-card";
import { CreateBoardDialog } from "@/components/boards/create-board-dialog";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { isAuthenticated, isLoading, restoreSession, displayName } = useAuthStore();
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setBoardsLoading(true);
    fetchBoards()
      .then(setBoards)
      .finally(() => setBoardsLoading(false));
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <NameDialog />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Boards</h1>
            <p className="text-sm text-gray-500 mt-1">Welcome back, {displayName}</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Board
          </Button>
        </div>

        {/* Grid */}
        {boardsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-white shadow-sm overflow-hidden">
                <div className="h-2 bg-gray-200 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-3/4 rounded bg-gray-200 animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="rounded-full bg-gray-100 p-4 mb-4">
              <Plus className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-medium text-gray-900">No boards yet</h2>
            <p className="text-sm text-gray-500 mt-1 mb-4">Create your first board to get started.</p>
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Board
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {boards.map((board) => (
              <BoardCard key={board.id} board={board} objectCount={board.object_count} />
            ))}
          </div>
        )}
      </div>

      <CreateBoardDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
