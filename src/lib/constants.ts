/** Shared across every image upload flow (profile avatar, client logo) — no bucket-level file_size_limit is configured in any migration, so this client-side check is the only enforcement. */
export const MAX_IMAGE_UPLOAD_BYTES = 8_000_000;
export const MAX_IMAGE_UPLOAD_LABEL = "8 MB";
