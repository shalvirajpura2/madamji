// chalk drawings for the board, keyed by the `diagram` field of a beat

const chalk = {
  fill: "none",
  stroke: "var(--color-chalk)",
  strokeWidth: 2.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Label({ x, y, children, color = "var(--color-chalk)", size = 15, anchor = "middle" }: {
  x: number; y: number; children: string; color?: string; size?: number; anchor?: "start" | "middle";
}) {
  return (
    <text x={x} y={y} fill={color} fontSize={size} textAnchor={anchor} fontFamily="var(--font-kalam)">
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
  "food-plate": (
    <>
      <circle cx="140" cy="70" r="58" {...chalk} />
      <circle cx="140" cy="70" r="50" {...chalk} strokeDasharray="4 6" />
      <circle cx="110" cy="48" r="16" {...chalk} stroke="var(--color-chalk-yellow)" />
      <Label x={110} y={53} size={12}>dal</Label>
      <circle cx="170" cy="48" r="16" {...chalk} stroke="var(--color-chalk-green)" />
      <Label x={170} y={53} size={12}>sabzi</Label>
      <circle cx="166" cy="96" r="14" {...chalk} />
      <Label x={166} y={100} size={12}>curd</Label>
      <ellipse cx="112" cy="96" rx="22" ry="12" {...chalk} stroke="var(--color-chalk-pink)" />
      <Label x={112} y={100} size={12}>roti</Label>
      <Label x={240} y={60} size={13}>+ salad</Label>
      <Label x={240} y={80} size={13}>+ water</Label>
    </>
  ),
  "iodine-test": (
    <>
      <path d="M60 40 h40 l-6 70 h-28Z" {...chalk} />
      <path d="M68 96 h24" {...chalk} stroke="var(--color-chalk-blue)" strokeWidth="8" />
      <Label x={80} y={130} size={13}>starch + iodine</Label>
      <path d="M130 75 h30 M152 67 l8 8 -8 8" {...chalk} stroke="var(--color-chalk-yellow)" />
      <ellipse cx="215" cy="80" rx="34" ry="22" {...chalk} />
      <ellipse cx="215" cy="80" rx="18" ry="10" fill="#1d2b5c" opacity="0.9" stroke="none" />
      <Label x={215} y={122} size={13}>blue-black!</Label>
    </>
  ),
  "states-of-water": (
    <>
      <rect x="22" y="40" width="44" height="44" rx="4" {...chalk} stroke="var(--color-chalk-blue)" />
      <Label x={44} y={110}>ice (solid)</Label>
      <path d="M118 50 v34 a6 6 0 0 0 6 6 h32 a6 6 0 0 0 6 -6 v-34" {...chalk} />
      <path d="M120 66 q10 -5 20 0 t20 0" {...chalk} stroke="var(--color-chalk-blue)" />
      <Label x={140} y={110}>water (liquid)</Label>
      <path d="M220 80 q-8 -12 0 -22 q8 -10 0 -22 M240 80 q-8 -12 0 -22 q8 -10 0 -22" {...chalk} strokeDasharray="3 6" />
      <Label x={232} y={110}>vapour (gas)</Label>
      <path d="M72 62 h30 M94 56 l8 6 -8 6 M168 62 h30 M190 56 l8 6 -8 6" {...chalk} stroke="var(--color-chalk-yellow)" />
    </>
  ),
  "water-cycle": (
    <>
      <circle cx="40" cy="30" r="14" {...chalk} stroke="var(--color-chalk-yellow)" />
      <path d="M150 36 a14 14 0 0 1 26 -6 a16 16 0 0 1 30 8 a12 12 0 0 1 -4 22 h-48 a12 12 0 0 1 -4 -24Z" {...chalk} />
      <path d="M20 118 q30 -10 60 0 t60 0" {...chalk} stroke="var(--color-chalk-blue)" />
      <path d="M70 104 q-6 -20 4 -40 M90 104 q-6 -20 4 -40" {...chalk} strokeDasharray="3 5" />
      <Label x={60} y={136} size={12}>evaporation</Label>
      <path d="M170 70 l-4 12 M186 70 l-4 12 M202 70 l-4 12" {...chalk} stroke="var(--color-chalk-blue)" />
      <Label x={186} y={98} size={12}>rain</Label>
      <Label x={180} y={20} size={12}>clouds (condensation)</Label>
      <path d="M230 110 l20 -40 l20 40" {...chalk} />
      <path d="M210 118 q-30 4 -60 0" {...chalk} stroke="var(--color-chalk-blue)" />
    </>
  ),
  "simple-circuit": (
    <>
      <rect x="50" y="24" width="180" height="92" rx="4" {...chalk} />
      <rect x="120" y="14" width="22" height="20" fill="var(--color-board)" stroke="none" />
      <line x1="126" y1="14" x2="126" y2="34" {...chalk} />
      <line x1="136" y1="19" x2="136" y2="29" {...chalk} />
      <circle cx="230" cy="70" r="14" {...chalk} fill="var(--color-board)" />
      <Label x={230} y={75}>A</Label>
      <circle cx="140" cy="116" r="14" {...chalk} fill="var(--color-board)" stroke="var(--color-chalk-yellow)" />
      <path d="M131 107 l18 18 M149 107 l-18 18" {...chalk} stroke="var(--color-chalk-yellow)" />
      <path d="M110 140 v-12 h60 v12" {...chalk} strokeDasharray="4 4" />
      <Label x={262} y={74} size={12}>series</Label>
      <Label x={140} y={10} size={12}>cell</Label>
      <Label x={206} y={138} size={12}>V across bulb</Label>
    </>
  ),
  "vi-graph": (
    <>
      <path d="M60 120 V18 M60 120 H250" {...chalk} />
      <path d="M60 120 L230 30" {...chalk} stroke="var(--color-chalk-yellow)" />
      <Label x={46} y={24}>V</Label>
      <Label x={250} y={136}>I</Label>
      <Label x={180} y={88} size={13} color="var(--color-chalk-yellow)">slope = R</Label>
    </>
  ),
  "series-parallel": (
    <>
      <Label x={70} y={18} size={13}>series</Label>
      <path d="M10 50 h20 l5 -8 l10 16 l10 -16 l10 16 l5 -8 h10 l5 -8 l10 16 l10 -16 l10 16 l5 -8 h20" {...chalk} />
      <Label x={70} y={84} size={12} color="var(--color-chalk-yellow)">Rs = R1 + R2</Label>
      <Label x={210} y={18} size={13}>parallel</Label>
      <path d="M150 60 h20 M250 60 h20 M170 40 v40 M250 40 v40" {...chalk} />
      <path d="M170 40 h20 l5 -8 l10 16 l10 -16 l5 8 h30 M170 80 h20 l5 -8 l10 16 l10 -16 l5 8 h30" {...chalk} />
      <Label x={210} y={116} size={12} color="var(--color-chalk-yellow)">1/Rp = 1/R1 + 1/R2</Label>
    </>
  ),
  "field-lines": (
    <>
      <rect x="100" y="58" width="80" height="24" rx="2" {...chalk} />
      <Label x={114} y={75} color="var(--color-chalk-pink)">N</Label>
      <Label x={166} y={75} color="var(--color-chalk-blue)">S</Label>
      <path d="M100 64 C70 20 210 20 180 64" {...chalk} stroke="var(--color-chalk-yellow)" />
      <path d="M100 60 C50 -6 230 -6 180 60" {...chalk} stroke="var(--color-chalk-yellow)" />
      <path d="M100 76 C70 120 210 120 180 76" {...chalk} stroke="var(--color-chalk-yellow)" />
      <path d="M100 80 C50 146 230 146 180 80" {...chalk} stroke="var(--color-chalk-yellow)" />
      <path d="M136 28 l6 -4 -6 -4 M136 112 l6 -4 -6 -4" {...chalk} stroke="var(--color-chalk-yellow)" />
    </>
  ),
  solenoid: (
    <>
      {[...Array(9)].map((_, i) => (
        <ellipse key={i} cx={70 + i * 17} cy="70" rx="8" ry="26" {...chalk} />
      ))}
      <path d="M40 70 h230" {...chalk} stroke="var(--color-chalk-yellow)" strokeDasharray="6 6" />
      <path d="M262 64 l8 6 -8 6" {...chalk} stroke="var(--color-chalk-yellow)" />
      <Label x={40} y={116} color="var(--color-chalk-blue)">S</Label>
      <Label x={250} y={116} color="var(--color-chalk-pink)">N</Label>
      <Label x={140} y={130} size={13}>uniform field inside</Label>
    </>
  ),
  photosynthesis: (
    <>
      <path d="M90 120 C90 60 130 30 190 30 C190 90 150 120 90 120Z" {...chalk} stroke="var(--color-chalk-green)" />
      <path d="M90 120 L160 56" {...chalk} stroke="var(--color-chalk-green)" />
      <circle cx="40" cy="30" r="14" {...chalk} stroke="var(--color-chalk-yellow)" />
      <path d="M58 40 l30 14" {...chalk} stroke="var(--color-chalk-yellow)" strokeDasharray="4 5" />
      <Label x={40} y={84} size={13}>CO₂ in →</Label>
      <Label x={40} y={136} size={13}>H₂O from roots ↑</Label>
      <Label x={240} y={60} size={13} color="var(--color-chalk-blue)">O₂ out →</Label>
      <Label x={240} y={100} size={13} color="var(--color-chalk-yellow)">glucose → starch</Label>
    </>
  ),
  "respiration-pathways": (
    <>
      <Label x={40} y={74} size={14}>glucose</Label>
      <path d="M70 70 h26 M90 64 l6 6 -6 6" {...chalk} />
      <Label x={128} y={74} size={14}>pyruvate</Label>
      <path d="M160 62 L190 26 M160 70 h30 M160 78 L190 114" {...chalk} />
      <Label x={194} y={24} size={11} anchor="start" color="var(--color-chalk-yellow)">yeast: ethanol + CO₂</Label>
      <Label x={194} y={74} size={11} anchor="start" color="var(--color-chalk-green)">O₂: CO₂ + H₂O + energy</Label>
      <Label x={194} y={122} size={11} anchor="start" color="var(--color-chalk-pink)">muscle: lactic acid</Label>
    </>
  ),
};

export const diagramIds = Object.keys(drawings);

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
