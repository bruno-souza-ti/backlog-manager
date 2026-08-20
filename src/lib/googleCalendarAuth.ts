import { supabase } from "./supabaseClient";

const CALENDAR_SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

/**
 * Connects (or reconnects) the user's Google Calendar.
 *
 * Supabase's `provider_token` (the actual Google access token) only ever
 * shows up in the session object right after an OAuth redirect completes —
 * it isn't persisted or auto-refreshed, so it goes stale on every reload.
 * `linkIdentity()` only works the *first* time: once the Google identity is
 * already attached to the account, Supabase rejects a second attempt with
 * "Identity is already linked". Reconnecting has to go through
 * `signInWithOAuth()` instead, which re-authenticates against that same
 * already-linked identity and just refreshes `provider_token`.
 */
export async function connectGoogleCalendar(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const alreadyLinked = !!session?.user.identities?.some((identity) => identity.provider === "google");
  const options = { scopes: CALENDAR_SCOPES, redirectTo: window.location.origin };

  const { error } = alreadyLinked
    ? await supabase.auth.signInWithOAuth({ provider: "google", options })
    : await supabase.auth.linkIdentity({ provider: "google", options });

  return error ? error.message : null;
}
