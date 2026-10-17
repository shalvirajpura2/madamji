import Link from "next/link";
import { Teacher } from "@/components/teacher";

// MadamJi logo: Meera Ma'am's face in a marigold circle, with the wordmark

export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-end justify-center overflow-hidden rounded-full bg-marigold/90 ring-2 ring-white ${className}`}>
      <Teacher headOnly mood="happy" className="h-[92%] w-[92%]" />
    </span>
  );
}

export function Logo({ size = "md", href = "/" }: { size?: "sm" | "md" | "lg"; href?: string | null }) {
  const mark = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14" }[size];
  const text = { sm: "text-lg", md: "text-2xl", lg: "text-3xl" }[size];
  const body = (
    <span className="inline-flex items-center gap-2">
      <LogoMark className={mark} />
      <span className={`${text} leading-none font-extrabold tracking-tight`}>
        Madam<span className="text-marigold-deep">Ji</span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="MadamJi home">
      {body}
    </Link>
  ) : (
    body
  );
}
