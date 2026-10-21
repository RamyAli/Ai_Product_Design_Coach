import { cn } from "@/lib/utils";

export function PageContainer({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8", wide ? "max-w-[1600px]" : "max-w-6xl", className)}>{children}</div>;
}
