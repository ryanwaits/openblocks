"use client";

import { useRouter } from "next/navigation";
import { Zap, Filter, Send, Coins, FileCode, Plus } from "lucide-react";
import { TEMPLATES } from "@/lib/workflow/templates";

const TEMPLATE_ICONS: Record<string, typeof Zap> = {
  "stx-transfer-monitor": Filter,
  "ft-transfer-tracker": Coins,
  "contract-call-monitor": FileCode,
};

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Zap size={16} />
          </div>
          <h1 className="text-lg font-semibold">Workflow Builder</h1>
        </div>
        <p className="mt-1 text-sm text-gray-400">
          Build event-driven workflows for Stacks blockchain
        </p>
      </header>

      {/* Content */}
      <main className="flex-1 px-8 py-8">
        <h2 className="mb-4 text-sm font-medium text-gray-400 uppercase tracking-wider">
          Start from a template
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TEMPLATES.map((t) => {
            const Icon = TEMPLATE_ICONS[t.id] ?? Send;
            return (
              <button
                key={t.id}
                onClick={() => router.push(`/workflow/${crypto.randomUUID()}?template=${t.id}`)}
                className="group flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-900 p-5 text-left transition-colors hover:border-gray-600 hover:bg-gray-800"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 text-blue-400 transition-colors group-hover:bg-blue-600/20">
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-100">{t.name}</h3>
                  <p className="mt-1 text-xs text-gray-500">{t.description}</p>
                </div>
              </button>
            );
          })}

          {/* Blank workflow */}
          <button
            onClick={() => router.push(`/workflow/${crypto.randomUUID()}`)}
            className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-5 text-center transition-colors hover:border-gray-500 hover:bg-gray-800/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 text-gray-400 transition-colors group-hover:bg-gray-700 group-hover:text-gray-300">
              <Plus size={20} />
            </div>
            <span className="text-sm font-medium text-gray-400 group-hover:text-gray-300">
              Create blank workflow
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
