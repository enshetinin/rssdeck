"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

import { isUuid } from "./view-params";

async function setEntryState(entryId: string, state: { read?: boolean; starred?: boolean }) {
  await requireUser();
  if (!isUuid(entryId)) throw new Error("Invalid entry id.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_entry_state", {
    p_entry_id: entryId,
    ...(state.read === undefined ? {} : { p_read: state.read }),
    ...(state.starred === undefined ? {} : { p_starred: state.starred }),
  });
  if (error) throw new Error(`Updating entry failed: ${error.message}`);

  revalidatePath("/", "layout");
}

export async function setEntryRead(entryId: string, read: boolean): Promise<void> {
  await setEntryState(entryId, { read });
}

export async function setEntryStarred(entryId: string, starred: boolean): Promise<void> {
  await setEntryState(entryId, { starred });
}

/** Marks every unread entry as read, in one feed or everywhere. */
export async function markAllRead(feedId: string | null): Promise<void> {
  await requireUser();
  if (feedId !== null && !isUuid(feedId)) throw new Error("Invalid feed id.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_entries_read", feedId ? { p_feed_id: feedId } : {});
  if (error) throw new Error(`Marking entries read failed: ${error.message}`);

  revalidatePath("/", "layout");
}
