import { cn } from "@/lib/utils";

/** Loading placeholder — design §8 prefers skeletons over spinners. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted-foreground/15",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
