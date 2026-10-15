// chalk drawings for the board, keyed by the `diagram` field of a beat

const chalk = {
  fill: "none",
  stroke: "var(--color-chalk)",
  strokeWidth: 2.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Label({ x, y, children, color = "var(--color-chalk)", size = 15 }: {
  x: number; y: number; children: string; color?: string; size?: number;
}) {
  return (
    <text x={x} y={y} fill={color} fontSize={size} textAnchor="middle" fontFamily="var(--font-kalam)">
      {children}
    </text>
  );
}

const drawings: Record<string, React.ReactNode> = {
  "magnet-shapes": (
    <>
      <rect x="20" y="40" width="90" height="26" rx="3" {...chalk} />
      <line x1="65" y1="40" x2="65" y2="66" {...chalk} />
      <Label x={42} y={58} color="var(--color-chalk-pink)">N</Label>
      <Label x={88} y={58} color="var(--color-chalk-blue)">S</Label>
      <Label x={65} y={92}>bar</Label>
      <path d="M140 30 v34 a22 22 0 0 0 44 0 v-34 h-12 v34 a10 10 0 0 1 -20 0 v-34Z" {...chalk} />
      <Label x={162} y={108}>horseshoe</Label>
      <circle cx="240" cy="54" r="22" {...chalk} />
      <circle cx="240" cy="54" r="9" {...chalk} />
      <Label x={240} y={100}>ring</Label>
    </>
  ),
  "bar-magnet-filings": (
    <>
      <rect x="70" y="50" width="140" height="30" rx="3" {...chalk} />
      <Label x={92} y={70} color="var(--color-chalk-pink)">N</Label>
      <Label x={188} y={70} color="var(--color-chalk-blue)">S</Label>
      {[...Array(14)].map((_, i) => (
        <line key={`l${i}`} x1={58 - (i % 3) * 6} y1={42 + i * 3.4} x2={64 - (i % 3) * 6} y2={44 + i * 3.4}
          stroke="var(--color-chalk-yellow)" strokeWidth="2" strokeLinecap="round" />
      ))}
      {[...Array(14)].map((_, i) => (
        <line key={`r${i}`} x1={216 + (i % 3) * 6} y1={42 + i * 3.4} x2={222 + (i % 3) * 6} y2={44 + i * 3.4}
          stroke="var(--color-chalk-yellow)" strokeWidth="2" strokeLinecap="round" />
      ))}
      <line x1="138" y1="88" x2="142" y2="90" stroke="var(--color-chalk-yellow)" strokeWidth="2" />
      <Label x={140} y={118} size={14}>most filings at the poles</Label>
    </>
  ),
  compass: (
    <>
      <circle cx="140" cy="68" r="48" {...chalk} />
      <circle cx="140" cy="68" r="4" {...chalk} />
      <path d="M140 28 L148 68 L140 108 L132 68Z" {...chalk} />
      <path d="M140 28 L148 68 L132 68Z" fill="var(--color-chalk-pink)" stroke="none" opacity="0.85" />
      <Label x={140} y={16} color="var(--color-chalk-yellow)">N</Label>
      <Label x={140} y={132}>S</Label>
      <Label x={200} y={73}>E</Label>
      <Label x={80} y={73}>W</Label>
    </>
  ),
  "attract-repel": (
    <>
      <rect x="20" y="24" width="70" height="22" rx="2" {...chalk} />
      <Label x={34} y={40} color="var(--color-chalk-pink)">N</Label>
      <Label x={78} y={40} color="var(--color-chalk-blue)">S</Label>
      <rect x="100" y="24" width="70" height="22" rx="2" {...chalk} />
      <Label x={114} y={40} color="var(--color-chalk-pink)">N</Label>
      <Label x={158} y={40} color="var(--color-chalk-blue)">S</Label>
      <Label x={210} y={41} color="var(--color-chalk-green)">attract ✓</Label>
      <rect x="20" y="78" width="70" height="22" rx="2" {...chalk} />
      <Label x={34} y={94} color="var(--color-chalk-pink)">N</Label>
      <Label x={78} y={94} color="var(--color-chalk-blue)">S</Label>
      <rect x="120" y="78" width="70" height="22" rx="2" {...chalk} />
      <Label x={134} y={94} color="var(--color-chalk-blue)">S</Label>
      <Label x={178} y={94} color="var(--color-chalk-pink)">N</Label>
      <path d="M94 89 l12 0 M100 83 l-6 6 6 6 M116 89 l-10 0" {...chalk} stroke="var(--color-chalk-yellow)" />
      <Label x={230} y={95} color="var(--color-chalk-pink)">repel ✗</Label>
    </>
  ),
};

export function hasDiagram(id?: string) {
  return Boolean(id && drawings[id]);
}

export function Diagram({ id }: { id: string }) {
  const art = drawings[id];
  if (!art) return null;
  return (
    <svg key={id} viewBox="0 0 280 140" className="chalk-draw h-full max-h-44 w-full" aria-hidden>
      {art}
    </svg>
  );
}
