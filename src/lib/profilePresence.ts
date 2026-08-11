import type { ProfileStatus } from "../types";
import { supabase } from "./supabaseClient";

export async function updateOwnPresence(status: ProfileStatus, currentClientId: string | null) {
  return supabase.rpc("update_my_presence", {
    p_status: status,
    p_current_client_id: currentClientId,
  });
}
