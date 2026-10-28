import crypto from "node:crypto";
import fs from "node:fs/promises";
import sharp from "sharp";
import { z } from "zod";
import { AVATAR_ID, DEFAULT_AVATAR } from "@/domain/avatars";
import { getDataPaths } from "../config";
import { AppError } from "../errors";
import { readImageMetadata } from "../ingestion/image";
import { ALLOWED_UPLOAD_TYPES, formatBytes, safeJoin, sniffMime } from "../ingestion/validation";
import { getSettings, updateSettings } from "../settings";

/** Lives under uploads/ so backups, restores and "clear all data" include it. Project ids never start with "_". */
const PROFILE_DIR = "_profile";
const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
const AVATAR_EDGE = 256;

export const ProfileSchema = z.object({
  displayName: z.string().trim().max(60),
  profileRole: z.string().trim().max(80),
  profileBio: z.string().trim().max(280),
  avatar: z.string().regex(AVATAR_ID),
});
export type ProfileInput = z.infer<typeof ProfileSchema>;

function profileDir(): string {
  return safeJoin(getDataPaths().uploads, PROFILE_DIR);
}

export function avatarUploadPath(filename: string): string {
  return safeJoin(profileDir(), filename);
}

export async function saveProfile(input: unknown) {
  const profile = ProfileSchema.parse(input);
  if (profile.avatar === "upload" && !(await getSettings()).avatarUpload) {
    throw new AppError("validation", "Upload a photo first, or choose one of the avatars.");
  }
  return updateSettings(profile);
}

/** Validates an uploaded photo by its bytes, crops it to a square and makes it the avatar. */
export async function saveAvatarUpload(bytes: Buffer) {
  if (bytes.length === 0) throw new AppError("validation", "The file is empty.");
  if (bytes.length > MAX_AVATAR_BYTES) {
    throw new AppError("validation", `The photo is ${formatBytes(bytes.length)}; the limit is ${formatBytes(MAX_AVATAR_BYTES)}.`);
  }
  const mime = sniffMime(bytes);
  if (!mime || ALLOWED_UPLOAD_TYPES[mime].kind !== "image") throw new AppError("validation", "Upload a PNG, JPEG or WebP image.");
  await readImageMetadata(bytes);

  await fs.mkdir(profileDir(), { recursive: true, mode: 0o700 });
  const filename = `avatar-${crypto.randomUUID()}.webp`;
  await sharp(bytes).rotate().resize(AVATAR_EDGE, AVATAR_EDGE, { fit: "cover", position: "attention" }).webp({ quality: 85 }).toFile(avatarUploadPath(filename));

  const previous = (await getSettings()).avatarUpload;
  const settings = await updateSettings({ avatar: "upload", avatarUpload: filename });
  if (previous && previous !== filename) await fs.rm(avatarUploadPath(previous), { force: true }).catch(() => undefined);
  return settings;
}

/** Deletes the uploaded photo. If it was the avatar, the default avatar takes its place. */
export async function removeAvatarUpload() {
  const settings = await getSettings();
  if (settings.avatarUpload) await fs.rm(avatarUploadPath(settings.avatarUpload), { force: true }).catch(() => undefined);
  return updateSettings({ avatarUpload: "", avatar: settings.avatar === "upload" ? DEFAULT_AVATAR : settings.avatar });
}
