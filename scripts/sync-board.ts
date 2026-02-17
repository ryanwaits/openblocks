import type { BoardObject } from "../src/types/board";

// --- CLI arg parsing ---

interface Args {
  room: string;
  dryRun: boolean;
  partyKitUrl: string;
  aiSecret: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx !== -1 ? argv[idx + 1] : undefined;
  };

  const room = get("--room") ?? "default";
  const dryRun = argv.includes("--dry-run");
  const partyKitUrl =
    get("--partykit-url") ?? process.env.NEXT_PUBLIC_PARTYKIT_URL ?? "";
  const aiSecret =
    get("--ai-secret") ?? process.env.NEXT_PUBLIC_AI_SECRET ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseServiceRoleKey =
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ?? "";

  return { room, dryRun, partyKitUrl, aiSecret, supabaseUrl, supabaseServiceRoleKey };
}

// --- Room ID resolution ---

function resolveRoomId(room: string): string {
  return room === "default" ? "00000000-0000-0000-0000-000000000000" : room;
}

// --- Supabase fetch ---

async function fetchSupabase(
  boardUUID: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<BoardObject[]> {
  const url = `${supabaseUrl}/rest/v1/board_objects?board_id=eq.${boardUUID}&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase fetch failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// --- PartyKit fetch ---

async function fetchPartyKit(
  baseUrl: string,
  room: string
): Promise<BoardObject[]> {
  const url = `${baseUrl}/parties/main/${room}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`PartyKit GET failed (${res.status}), treating as empty`);
      return [];
    }
    const data = await res.json() as { objects?: BoardObject[] };
    return data.objects ?? [];
  } catch (e) {
    console.warn("PartyKit unreachable, treating as empty:", (e as Error).message);
    return [];
  }
}

// --- Diff ---

interface DiffResult {
  toCreate: BoardObject[];
  toUpdate: BoardObject[];
  toDelete: string[];
}

function diff(supabase: BoardObject[], partykit: BoardObject[]): DiffResult {
  const supabaseMap = new Map(supabase.map((o) => [o.id, o]));
  const partykitMap = new Map(partykit.map((o) => [o.id, o]));

  const toCreate: BoardObject[] = [];
  const toUpdate: BoardObject[] = [];
  const toDelete: string[] = [];

  // Supabase-only → create; both + Supabase newer → update
  for (const [id, sObj] of supabaseMap) {
    const pObj = partykitMap.get(id);
    if (!pObj) {
      toCreate.push(sObj);
    } else if (new Date(sObj.updated_at) > new Date(pObj.updated_at)) {
      toUpdate.push(sObj);
    }
  }

  // PartyKit-only → delete
  for (const id of partykitMap.keys()) {
    if (!supabaseMap.has(id)) {
      toDelete.push(id);
    }
  }

  return { toCreate, toUpdate, toDelete };
}

// --- Summary ---

function snippet(obj: BoardObject): string {
  const text = obj.text ? `"${obj.text.slice(0, 30)}"` : "(empty)";
  return `${obj.id.slice(0, 8)} ${obj.type} ${text}`;
}

function printSummary(
  supabase: BoardObject[],
  partykit: BoardObject[],
  result: DiffResult
) {
  console.log(`\nSupabase: ${supabase.length} objects`);
  console.log(`PartyKit: ${partykit.length} objects\n`);

  if (
    result.toCreate.length === 0 &&
    result.toUpdate.length === 0 &&
    result.toDelete.length === 0
  ) {
    console.log("In sync — nothing to do.");
    return;
  }

  if (result.toCreate.length > 0) {
    console.log(`Create (${result.toCreate.length}):`);
    result.toCreate.forEach((o) => console.log(`  + ${snippet(o)}`));
  }
  if (result.toUpdate.length > 0) {
    console.log(`Update (${result.toUpdate.length}):`);
    result.toUpdate.forEach((o) => console.log(`  ~ ${snippet(o)}`));
  }
  if (result.toDelete.length > 0) {
    console.log(`Delete (${result.toDelete.length}):`);
    result.toDelete.forEach((id) => console.log(`  - ${id.slice(0, 8)}`));
  }
  console.log();
}

// --- Push to PartyKit ---

async function pushToPartyKit(
  baseUrl: string,
  room: string,
  aiSecret: string,
  result: DiffResult
) {
  const actions: Array<{
    type: "create" | "update" | "delete";
    object?: BoardObject;
    objectId?: string;
  }> = [
    ...result.toCreate.map((o) => ({ type: "create" as const, object: o })),
    ...result.toUpdate.map((o) => ({ type: "update" as const, object: o })),
    ...result.toDelete.map((id) => ({ type: "delete" as const, objectId: id })),
  ];

  const url = `${baseUrl}/parties/main/${room}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ actions }),
  });

  if (!res.ok) {
    throw new Error(`PartyKit POST failed (${res.status}): ${await res.text()}`);
  }

  const body = await res.json() as { processed?: number };
  console.log(`Pushed ${body.processed ?? actions.length} actions to PartyKit.`);
}

// --- Main ---

async function main() {
  const args = parseArgs();

  const missing: string[] = [];
  if (!args.partyKitUrl) missing.push("--partykit-url or NEXT_PUBLIC_PARTYKIT_URL");
  if (!args.aiSecret) missing.push("--ai-secret or NEXT_PUBLIC_AI_SECRET");
  if (!args.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!args.supabaseServiceRoleKey) missing.push("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    console.error("Missing required config:\n  " + missing.join("\n  "));
    process.exit(1);
  }

  const boardUUID = resolveRoomId(args.room);
  console.log(`Syncing room "${args.room}" (${boardUUID})`);
  if (args.dryRun) console.log("(dry run — no changes will be pushed)\n");

  const [supabase, partykit] = await Promise.all([
    fetchSupabase(boardUUID, args.supabaseUrl, args.supabaseServiceRoleKey),
    fetchPartyKit(args.partyKitUrl, args.room),
  ]);

  const result = diff(supabase, partykit);
  printSummary(supabase, partykit, result);

  const hasChanges =
    result.toCreate.length + result.toUpdate.length + result.toDelete.length > 0;

  if (!hasChanges) return;

  if (args.dryRun) {
    console.log("Dry run — skipping push.");
    return;
  }

  await pushToPartyKit(args.partyKitUrl, args.room, args.aiSecret, result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
