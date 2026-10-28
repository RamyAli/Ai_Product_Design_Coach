import { avatarSrc, isAnimatedAvatar } from "@/domain/avatars";
import { cn } from "@/lib/utils";

export interface AvatarInfo {
  avatar: string;
  /** Changes with each uploaded photo; empty for presets. */
  uploadKey: string;
}

/** Circular profile picture. The two default avatars have a small idle animation. */
export function UserAvatar({ avatar, uploadKey, className, animate = true }: AvatarInfo & { className?: string; animate?: boolean }) {
  const animated = animate && isAnimatedAvatar(avatar);
  const photo = avatar === "upload";
  return (
    <span className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full bg-primary-soft", className)} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarSrc(avatar, uploadKey)}
        alt=""
        draggable={false}
        className={cn(
          "size-full",
          photo ? "object-cover" : "object-contain p-[6%]",
          animated && (avatar === "default-female" ? "avatar-idle avatar-idle-alt" : "avatar-idle"),
        )}
      />
    </span>
  );
}
