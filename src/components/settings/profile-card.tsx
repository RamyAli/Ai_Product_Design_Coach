"use client";

import { Check, ImagePlus, LayoutGrid, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { updateProfileAction } from "@/app/actions/settings";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { DEFAULT_AVATARS, MEMOJI_AVATARS } from "@/domain/avatars";
import { cn } from "@/lib/utils";

export interface ProfileData {
  displayName: string;
  profileRole: string;
  profileBio: string;
  avatar: string;
  avatarUpload: string;
}

const BIO_MAX = 280;

/** A selectable round avatar tile. */
function AvatarOption({
  avatar,
  uploadKey,
  label,
  selected,
  onSelect,
  className,
}: {
  avatar: string;
  uploadKey: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={cn(
        "relative rounded-full p-0.5 ring-2 ring-transparent transition-shadow hover:ring-border-strong",
        selected && "ring-interactive hover:ring-interactive",
        className,
      )}
    >
      <UserAvatar avatar={avatar} uploadKey={uploadKey} className="size-full" />
      {selected ? (
        <span className="absolute -bottom-0.5 -end-0.5 flex size-5 items-center justify-center rounded-full bg-interactive text-on-interactive ring-2 ring-surface" aria-hidden>
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

export function ProfileCard({ profile }: { profile: ProfileData }) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    displayName: profile.displayName,
    profileRole: profile.profileRole,
    profileBio: profile.profileBio,
    avatar: profile.avatar,
  });
  const dirty =
    form.displayName !== profile.displayName ||
    form.profileRole !== profile.profileRole ||
    form.profileBio !== profile.profileBio ||
    form.avatar !== profile.avatar;
  const busy = pending || uploading;
  const name = form.displayName.trim() || t("you");
  const pick = (avatar: string) => setForm((f) => ({ ...f, avatar }));

  const save = () =>
    start(async () => {
      const res = await updateProfileAction(form);
      if (res.ok) {
        toast.push(t("saved"), "success");
        router.refresh();
      } else toast.push(res.error.message, "error");
    });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: { message: string } } | null;
      if (!json?.ok) {
        toast.push(json?.error?.message ?? t("uploadFailed"), "error");
        return;
      }
      setForm((f) => ({ ...f, avatar: "upload" }));
      toast.push(t("photoSaved"), "success");
      router.refresh();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = () =>
    start(async () => {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as { ok: boolean; data?: { avatar: string } } | null;
      if (json?.ok && json.data) {
        setForm((f) => ({ ...f, avatar: f.avatar === "upload" ? json.data!.avatar : f.avatar }));
        toast.push(t("photoRemoved"), "success");
        router.refresh();
      } else toast.push(t("uploadFailed"), "error");
    });

  const memojiInSet = MEMOJI_AVATARS.includes(form.avatar);

  return (
    <Card id="profile" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-4" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Preview */}
          <div className="flex shrink-0 flex-col items-center gap-2 md:w-44">
            <UserAvatar avatar={form.avatar} uploadKey={profile.avatarUpload} className="size-28 ring-1 ring-border" />
            <p className="max-w-full truncate text-center text-sm font-semibold" dir="auto">
              {name}
            </p>
            {form.profileRole.trim() ? (
              <p className="-mt-1.5 max-w-full truncate text-center text-xs text-subtle" dir="auto">
                {form.profileRole}
              </p>
            ) : null}
          </div>

          {/* Details */}
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <Field id="profile-name" label={t("name")} optional={tc("optional")}>
              {(p) => <Input {...p} value={form.displayName} maxLength={60} autoComplete="name" dir="auto" onChange={(e) => setForm({ ...form, displayName: e.target.value })} />}
            </Field>
            <Field id="profile-role" label={t("role")} hint={t("roleHint")} optional={tc("optional")}>
              {(p) => <Input {...p} value={form.profileRole} maxLength={80} autoComplete="organization-title" dir="auto" onChange={(e) => setForm({ ...form, profileRole: e.target.value })} />}
            </Field>
            <Field
              id="profile-bio"
              label={t("bio")}
              hint={t("bioCount", { count: form.profileBio.length, max: BIO_MAX })}
              optional={tc("optional")}
              className="sm:col-span-2"
            >
              {(p) => <Textarea {...p} rows={3} value={form.profileBio} maxLength={BIO_MAX} dir="auto" onChange={(e) => setForm({ ...form, profileBio: e.target.value })} />}
            </Field>
          </div>
        </div>

        {/* Avatar choice */}
        <fieldset className="flex flex-col gap-3 border-t border-border pt-5">
          <legend className="sr-only">{t("avatar")}</legend>
          <p className="text-sm font-semibold" aria-hidden>
            {t("avatar")}
          </p>
          <div className="flex flex-wrap items-start gap-5">
            {DEFAULT_AVATARS.map((id) => (
              <div key={id} className="flex flex-col items-center gap-1.5">
                <AvatarOption avatar={id} uploadKey="" label={t(id === "default-male" ? "defaultMale" : "defaultFemale")} selected={form.avatar === id} onSelect={() => pick(id)} className="size-16" />
                <span className="text-xs text-muted">{t(id === "default-male" ? "male" : "female")}</span>
              </div>
            ))}
            {profile.avatarUpload ? (
              <div className="flex flex-col items-center gap-1.5">
                <AvatarOption avatar="upload" uploadKey={profile.avatarUpload} label={t("yourPhoto")} selected={form.avatar === "upload"} onSelect={() => pick("upload")} className="size-16" />
                <span className="text-xs text-muted">{t("yourPhoto")}</span>
              </div>
            ) : null}
            {memojiInSet ? (
              <div className="flex flex-col items-center gap-1.5">
                <AvatarOption avatar={form.avatar} uploadKey="" label={t("fromSet")} selected onSelect={() => setSetOpen(true)} className="size-16" />
                <span className="text-xs text-muted">{t("fromSet")}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Dialog open={setOpen} onOpenChange={setSetOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy}>
                  <LayoutGrid aria-hidden />
                  {t("browseSet", { count: MEMOJI_AVATARS.length })}
                </Button>
              </DialogTrigger>
              <DialogContent closeLabel={tc("close")} className="max-w-2xl">
                <DialogTitle>{t("setTitle")}</DialogTitle>
                <DialogDescription>{t("setBody")}</DialogDescription>
                <div className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-8">
                  {MEMOJI_AVATARS.map((id, i) => (
                    <AvatarOption
                      key={id}
                      avatar={id}
                      uploadKey=""
                      label={t("setItem", { number: i + 1 })}
                      selected={form.avatar === id}
                      onSelect={() => {
                        pick(id);
                        setSetOpen(false);
                      }}
                      className="aspect-square w-full"
                    />
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImagePlus aria-hidden />
              {uploading ? t("uploading") : profile.avatarUpload ? t("replacePhoto") : t("uploadPhoto")}
            </Button>
            {profile.avatarUpload ? (
              <Button variant="ghost" size="sm" disabled={busy} onClick={removePhoto}>
                <Trash2 aria-hidden />
                {t("removePhoto")}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-subtle">{t("uploadHint")}</p>
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            variant="ghost"
            disabled={busy || !dirty}
            onClick={() => setForm({ displayName: profile.displayName, profileRole: profile.profileRole, profileBio: profile.profileBio, avatar: profile.avatar })}
          >
            {tc("cancel")}
          </Button>
          <Button disabled={busy || !dirty} onClick={save}>
            {t("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
