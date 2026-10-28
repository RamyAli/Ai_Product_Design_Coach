/**
 * Profile avatars. Presets are static images in /public/avatars, exported from the
 * "Free 3D Memoji Avatars Pack" Figma community file. "upload" means the user's own photo,
 * stored in the data directory and served by /api/profile/avatar.
 */

export const DEFAULT_AVATARS = ["default-male", "default-female"] as const;
export const MEMOJI_COUNT = 45;
export const MEMOJI_AVATARS = Array.from({ length: MEMOJI_COUNT }, (_, i) => `memoji-${String(i + 1).padStart(2, "0")}`);
export const PRESET_AVATARS: readonly string[] = [...DEFAULT_AVATARS, ...MEMOJI_AVATARS];

export const AVATAR_ID = /^(default-(male|female)|memoji-(0[1-9]|[1-3]\d|4[0-5])|upload)$/;
export const DEFAULT_AVATAR = "default-male";

/** The two default avatars gently animate; everything else is still. */
export function isAnimatedAvatar(id: string): boolean {
  return (DEFAULT_AVATARS as readonly string[]).includes(id);
}

/** Image URL for an avatar. `uploadKey` changes with each upload so browsers fetch the new photo. */
export function avatarSrc(id: string, uploadKey = ""): string {
  if (id === "upload") return `/api/profile/avatar?v=${encodeURIComponent(uploadKey)}`;
  return `/avatars/${PRESET_AVATARS.includes(id) ? id : DEFAULT_AVATAR}.webp`;
}
