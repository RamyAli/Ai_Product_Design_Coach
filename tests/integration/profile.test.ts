import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { getDataPaths } from "@/server/config";
import { avatarUploadPath, removeAvatarUpload, saveAvatarUpload, saveProfile } from "@/server/services/profile";
import { getSettings, parseSettingsPatch, updateSettings } from "@/server/settings";
import { makePng } from "../fixtures/files";

describe("profile and avatar", () => {
  it("defaults to the male default avatar and saves profile details", async () => {
    expect((await getSettings()).avatar).toBe("default-male");
    await saveProfile({ displayName: "  Ramy ", profileRole: "Product designer", profileBio: "Learning by doing.", avatar: "memoji-12" });
    const s = await getSettings();
    expect(s).toMatchObject({ displayName: "Ramy", profileRole: "Product designer", profileBio: "Learning by doing.", avatar: "memoji-12" });
  });

  it("rejects unknown avatars and choosing an upload that does not exist", async () => {
    await expect(saveProfile({ displayName: "", profileRole: "", profileBio: "", avatar: "memoji-46" })).rejects.toThrow();
    await expect(saveProfile({ displayName: "", profileRole: "", profileBio: "", avatar: "../../etc/passwd" })).rejects.toThrow();
    await removeAvatarUpload();
    await expect(saveProfile({ displayName: "", profileRole: "", profileBio: "", avatar: "upload" })).rejects.toMatchObject({ code: "validation" });
  });

  it("stores an uploaded photo as a 256px square inside the uploads folder, replaces and removes it", async () => {
    const first = await saveAvatarUpload(await makePng("#ff0000", 640, 320));
    expect(first.avatar).toBe("upload");
    const firstPath = avatarUploadPath(first.avatarUpload);
    expect(path.relative(getDataPaths().uploads, firstPath).startsWith("_profile")).toBe(true);
    const meta = await sharp(fs.readFileSync(firstPath)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 256, 256]);

    const second = await saveAvatarUpload(await makePng("#00ff00"));
    expect(second.avatarUpload).not.toBe(first.avatarUpload);
    expect(fs.existsSync(firstPath)).toBe(false);

    const removed = await removeAvatarUpload();
    expect(removed).toMatchObject({ avatar: "default-male", avatarUpload: "" });
    expect(fs.existsSync(avatarUploadPath(second.avatarUpload))).toBe(false);
  });

  it("keeps the uploaded photo when another avatar is chosen, and saving one setting leaves the others alone", async () => {
    const uploaded = await saveAvatarUpload(await makePng());
    await updateSettings({ strictness: "demanding", aiModel: "claude-sonnet-5-5" });
    await saveProfile({ displayName: "Ramy", profileRole: "", profileBio: "", avatar: "default-female" });
    await updateSettings({ theme: "dark" });
    const s = await getSettings();
    expect(s).toMatchObject({ avatar: "default-female", avatarUpload: uploaded.avatarUpload, strictness: "demanding", aiModel: "claude-sonnet-5-5", theme: "dark" });
    expect(parseSettingsPatch({ displayName: "x", avatarUpload: "evil", unknown: 1 }, ["avatarUpload"])).toEqual({ displayName: "x" });
    await removeAvatarUpload();
  });

  it("refuses files that are not images, whatever their name", async () => {
    await expect(saveAvatarUpload(Buffer.from("%PDF-1.4 not an avatar"))).rejects.toMatchObject({ code: "validation" });
    await expect(saveAvatarUpload(Buffer.from("plain text"))).rejects.toMatchObject({ code: "validation" });
    await expect(saveAvatarUpload(Buffer.alloc(0))).rejects.toMatchObject({ code: "validation" });
  });
});
