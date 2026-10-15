// small hand-drawn icons for chapter cards

const common = { fill: "none", strokeWidth: 3.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function ChapterArt({ icon, className = "" }: { icon: string; className?: string }) {
  switch (icon) {
    case "magnet":
      return (
        <svg viewBox="0 0 64 64" className={className} {...common}>
          <path d="M18 12 v22 a14 14 0 0 0 28 0 v-22" stroke="#d64545" strokeWidth="9" />
          <path d="M18 12 v8 M46 12 v8" stroke="#e8e2d4" strokeWidth="9" />
          <path d="M10 50 l-4 4 M54 50 l4 4 M32 56 v5" stroke="#f5a524" />
        </svg>
      );
    case "food":
      return (
        <svg viewBox="0 0 64 64" className={className} {...common}>
          <ellipse cx="32" cy="40" rx="25" ry="10" stroke="#9a6a3c" fill="#fbe9cf" />
          <circle cx="22" cy="36" r="6" stroke="#3f8f5a" fill="#b6eab0" />
          <circle cx="36" cy="34" r="7" stroke="#dc8a0b" fill="#f8e27c" />
          <path d="M44 38 q4 -8 9 -2" stroke="#d64545" />
          <path d="M28 18 q4 -6 0 -10 M36 20 q4 -6 0 -10" stroke="#a4a4a4" />
        </svg>
      );
    case "water":
      return (
        <svg viewBox="0 0 64 64" className={className} {...common}>
          <path d="M32 8 C22 24 16 32 16 40 a16 16 0 0 0 32 0 c0 -8 -6 -16 -16 -32Z" stroke="#4c9be8" fill="#a4d6f6" />
          <path d="M24 42 a8 8 0 0 0 8 8" stroke="#fff" />
        </svg>
      );
    case "electromagnet":
      return (
        <svg viewBox="0 0 64 64" className={className} {...common}>
          <rect x="14" y="26" width="36" height="12" rx="3" stroke="#6b5a4a" fill="#d9d2c3" />
          <path d="M18 24 v16 M24 24 v16 M30 24 v16 M36 24 v16 M42 24 v16 M46 24 v16" stroke="#dc8a0b" />
          <path d="M8 32 h6 M50 32 h6" stroke="#6b5a4a" />
          <path d="M20 14 q12 -8 24 0 M20 50 q12 8 24 0" stroke="#8e5bd8" />
        </svg>
      );
    case "bulb":
      return (
        <svg viewBox="0 0 64 64" className={className} {...common}>
          <path d="M22 30 a10 10 0 1 1 20 0 c0 6 -5 8 -5 14 h-10 c0 -6 -5 -8 -5 -14Z" stroke="#dc8a0b" fill="#f8e27c" />
          <path d="M27 50 h10 M28 55 h8" stroke="#6b5a4a" />
          <path d="M32 6 v5 M12 28 h-5 M57 28 h-5 M16 12 l4 4 M48 12 l-4 4" stroke="#f5a524" />
        </svg>
      );
    case "leaf":
      return (
        <svg viewBox="0 0 64 64" className={className} {...common}>
          <path d="M12 52 C12 26 30 10 54 10 C54 36 38 52 12 52Z" stroke="#3f8f5a" fill="#b6eab0" />
          <path d="M12 52 L40 24 M26 38 h10 M32 32 v-8" stroke="#3f8f5a" />
          <circle cx="50" cy="48" r="5" stroke="#f5a524" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 64" className={className} {...common}>
          <circle cx="32" cy="32" r="20" stroke="#3f8f5a" />
        </svg>
      );
  }
}
