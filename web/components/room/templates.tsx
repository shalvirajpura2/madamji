// Science drawings made by code, so the physics is right by construction.
// The teacher only picks the template and its settings (validated by the agent).

const C = {
  chalk: "var(--color-chalk)",
  yellow: "var(--color-chalk-yellow)",
  pink: "var(--color-chalk-pink)",
  blue: "var(--color-chalk-blue)",
  green: "var(--color-chalk-green)",
};
const line = { fill: "none", stroke: C.chalk, strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Label({
  x,
  y,
  children,
  color = C.chalk,
  size = 13,
  anchor = "middle",
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  color?: string;
  size?: number;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text x={x} y={y} fill={color} fontSize={size} textAnchor={anchor} fontFamily="var(--font-kalam)" stroke="none">
      {children}
    </text>
  );
}

// a small chevron with its tip at (x, y), pointing along angle (degrees, 0 = right, 90 = down)
function Arrow({ x, y, angle, color = C.yellow }: { x: number; y: number; angle: number; color?: string }) {
  const a = (angle * Math.PI) / 180;
  const wing = (d: number) => {
    const t = a + Math.PI + (d * Math.PI) / 180;
    return `${(x + 7 * Math.cos(t)).toFixed(1)} ${(y + 7 * Math.sin(t)).toFixed(1)}`;
  };
  return <path d={`M${wing(-28)} L${x} ${y} L${wing(28)}`} {...line} stroke={color} />;
}

type MagnetParams = { left: "N" | "S"; right: "N" | "S" };

function Magnets({ left, right }: MagnetParams) {
  const other = (p: string) => (p === "N" ? "S" : "N");
  const tone = (p: string) => (p === "N" ? C.pink : C.blue);
  const like = left === right;
  const away = left === "N"; // like poles: lines leave N poles, and come into S poles
  return (
    <>
      <rect x="20" y="58" width="80" height="24" rx="2" {...line} />
      <rect x="180" y="58" width="80" height="24" rx="2" {...line} />
      <Label x={32} y={75} color={tone(other(left))}>{other(left)}</Label>
      <Label x={88} y={75} color={tone(left)}>{left}</Label>
      <Label x={192} y={75} color={tone(right)}>{right}</Label>
      <Label x={248} y={75} color={tone(other(right))}>{other(right)}</Label>
      {like ? (
        <>
          <g {...line} stroke={C.yellow}>
            <path d="M100 63 C116 62 124 52 124 30" />
            <path d="M100 70 L118 70" />
            <path d="M100 77 C116 78 124 88 124 110" />
            <path d="M180 63 C164 62 156 52 156 30" />
            <path d="M180 70 L162 70" />
            <path d="M180 77 C164 78 156 88 156 110" />
          </g>
          <Arrow x={124} y={away ? 36 : 44} angle={away ? -90 : 90} />
          <Arrow x={124} y={away ? 104 : 96} angle={away ? 90 : -90} />
          <Arrow x={156} y={away ? 36 : 44} angle={away ? -90 : 90} />
          <Arrow x={156} y={away ? 104 : 96} angle={away ? 90 : -90} />
          <Arrow x={away ? 116 : 104} y={70} angle={away ? 0 : 180} />
          <Arrow x={away ? 164 : 176} y={70} angle={away ? 180 : 0} />
          <path d="M136 66 l8 8 M144 66 l-8 8" {...line} stroke={C.pink} />
          <Label x={140} y={130} size={11}>neutral point (no field)</Label>
          <Label x={140} y={16}>Like poles repel</Label>
        </>
      ) : (
        <>
          <g {...line} stroke={C.yellow}>
            <path d="M100 63 L180 63" />
            <path d="M100 70 L180 70" />
            <path d="M100 77 L180 77" />
            <path d="M100 60 Q140 34 180 60" />
            <path d="M100 80 Q140 106 180 80" />
          </g>
          {[63, 70, 77].map((y) => (
            <Arrow key={y} x={left === "N" ? 144 : 136} y={y} angle={left === "N" ? 0 : 180} />
          ))}
          <Arrow x={left === "N" ? 144 : 136} y={47} angle={left === "N" ? 0 : 180} />
          <Arrow x={left === "N" ? 144 : 136} y={93} angle={left === "N" ? 0 : 180} />
          <Label x={140} y={16}>Unlike poles attract</Label>
          <Label x={140} y={130} size={11}>field lines go from N to S</Label>
        </>
      )}
    </>
  );
}

function zigzag(cx: number, y: number) {
  return `M${cx - 18} ${y} l3 -6 l6 12 l6 -12 l6 12 l6 -12 l6 12 l3 -6`;
}

function Circuit({ kind, count, bulb }: { kind: "series" | "parallel"; count: number; bulb: boolean }) {
  const n = Math.min(3, Math.max(2, count));
  const names = ["R1", "R2", "R3"].slice(0, n);
  const formula = kind === "series" ? `Rs = ${names.join(" + ")}` : `1/Rp = ${names.map((r) => `1/${r}`).join(" + ")}`;
  return (
    <>
      {/* cell: long plate is +, short plate is - */}
      <path d="M40 30 L132 30 M148 30 L240 30" {...line} />
      <path d="M134 18 L134 42" {...line} strokeWidth={3} />
      <path d="M146 24 L146 36" {...line} strokeWidth={3} />
      <Label x={134} y={54} size={12} color={C.pink}>+</Label>
      <Label x={146} y={54} size={12} color={C.blue}>−</Label>
      {/* left side and right side (with optional bulb) */}
      <path d="M40 30 L40 105" {...line} />
      {bulb ? (
        <>
          <path d="M240 30 L240 58 M240 78 L240 105" {...line} />
          <circle cx="240" cy="68" r="10" {...line} stroke={C.yellow} />
          <path d="M233 61 l14 14 M247 61 l-14 14" {...line} stroke={C.yellow} />
        </>
      ) : (
        <path d="M240 30 L240 105" {...line} />
      )}
      {kind === "series" ? (
        <>
          {(n === 2 ? [105, 175] : [85, 140, 195]).map((cx, i, all) => (
            <g key={cx}>
              <path d={zigzag(cx, 105)} {...line} stroke={C.yellow} />
              <Label x={cx} y={96} size={11}>{names[i]}</Label>
              <path d={`M${i === 0 ? 40 : all[i - 1] + 18} 105 L${cx - 18} 105`} {...line} />
            </g>
          ))}
          <path d={`M${(n === 2 ? 175 : 195) + 18} 105 L240 105`} {...line} />
        </>
      ) : (
        <>
          <path d="M40 105 L80 105 M200 105 L240 105" {...line} />
          {(n === 2 ? [92, 118] : [84, 105, 126]).map((y, i, ys) => (
            <g key={y}>
              <path d={`M80 ${y} L122 ${y} M158 ${y} L200 ${y}`} {...line} />
              <path d={zigzag(140, y)} {...line} stroke={C.yellow} />
              <Label x={106} y={y - 3} size={10}>{names[i]}</Label>
              {i === 0 && <path d={`M80 ${ys[0]} L80 ${ys[ys.length - 1]} M200 ${ys[0]} L200 ${ys[ys.length - 1]}`} {...line} />}
            </g>
          ))}
        </>
      )}
      {/* conventional current: out of +, round the circuit, back into - */}
      <Arrow x={86} y={30} angle={180} />
      <Arrow x={40} y={72} angle={90} />
      <Arrow x={240} y={bulb ? 98 : 72} angle={-90} />
      <Arrow x={200} y={30} angle={180} />
      <Label x={274} y={16} size={10} anchor="end">{formula}</Label>
      <Label x={64} y={52} size={11} color={C.yellow}>current I</Label>
    </>
  );
}

function WireField({ current }: { current: "up" | "down" }) {
  const up = current === "up";
  return (
    <>
      <ellipse cx="140" cy="48" rx="46" ry="11" {...line} stroke={C.yellow} />
      <ellipse cx="140" cy="92" rx="70" ry="16" {...line} stroke={C.yellow} />
      {/* field direction on the front (lower) arc: anticlockwise seen from above when current is up */}
      <Arrow x={up ? 112 : 168} y={58} angle={up ? 0 : 180} />
      <Arrow x={up ? 100 : 180} y={107} angle={up ? 0 : 180} />
      <path d="M140 8 L140 122" {...line} strokeWidth={4} />
      <Arrow x={140} y={up ? 14 : 118} angle={up ? -90 : 90} color={C.pink} />
      <Label x={154} y={up ? 22 : 116} color={C.pink}>I</Label>
      <Label x={218} y={52} size={12} color={C.yellow}>field B</Label>
      <Label x={140} y={136} size={10}>right-hand thumb rule: thumb along I, fingers curl with B</Label>
    </>
  );
}

function Ray({ kind }: { kind: "air-glass" | "glass-air" | "reflection" }) {
  if (kind === "reflection") {
    return (
      <>
        <path d="M40 100 L240 100" {...line} strokeWidth={3} />
        {[50, 70, 90, 110, 130, 150, 170, 190, 210, 230].map((x) => (
          <path key={x} d={`M${x} 100 l-8 9`} {...line} strokeWidth={1.5} />
        ))}
        <path d="M140 18 L140 100" {...line} strokeDasharray="5 5" />
        <path d="M80 30 L140 100 L200 30" {...line} stroke={C.yellow} />
        <Arrow x={113} y={62} angle={49.4} />
        <Arrow x={176} y={58} angle={-49.4} />
        <Label x={130} y={74} size={12}>i</Label>
        <Label x={150} y={74} size={12}>r</Label>
        <Label x={140} y={14} size={11}>normal</Label>
        <Label x={232} y={124} size={11}>angle i = angle r</Label>
      </>
    );
  }
  const intoGlass = kind === "air-glass";
  // n = 1.5: 60° in air pairs with 35.3° in glass
  const start = intoGlass ? [79.4, 35] : [99.8, 12.7];
  const end = intoGlass ? [180.4, 127.1] : [200.6, 105];
  return (
    <>
      <path d="M10 70 L270 70" {...line} />
      <path d="M140 8 L140 132" {...line} strokeDasharray="5 5" />
      <Label x={40} y={60} size={12}>{intoGlass ? "Air" : "Glass"}</Label>
      <Label x={40} y={92} size={12}>{intoGlass ? "Glass" : "Air"}</Label>
      <Label x={156} y={16} size={11}>normal</Label>
      <path d={`M${start[0]} ${start[1]} L140 70 L${end[0]} ${end[1]}`} {...line} stroke={C.yellow} />
      <Arrow x={(start[0] + 140) / 2 + 3} y={(start[1] + 70) / 2 + 2} angle={intoGlass ? 30 : 55} />
      <Arrow x={(140 + end[0]) / 2 + 2} y={(70 + end[1]) / 2 + 3} angle={intoGlass ? 54.7 : 30} />
      <Label x={222} y={30} size={11}>{intoGlass ? "bends towards the normal" : "bends away from the normal"}</Label>
    </>
  );
}

function Flow({ steps }: { steps: string[] }) {
  const list = steps.slice(0, 6);
  const twoRows = list.length > 3;
  const spots = list.map((_, i) => {
    const row = i < 3 ? 0 : 1;
    const col = row === 0 ? i : 2 - (i - 3); // second row runs right to left, like a snake
    return { x: [50, 140, 230][col], y: twoRows ? (row === 0 ? 38 : 102) : 70 };
  });
  return (
    <>
      {list.map((step, i) => {
        const { x, y } = spots[i];
        const words = step.split(" ");
        const half = Math.ceil(words.length / 2);
        const lines = step.length > 12 && words.length > 1 ? [words.slice(0, half).join(" "), words.slice(half).join(" ")] : [step];
        return (
          <g key={i}>
            <rect x={x - 40} y={y - 16} width="80" height="32" rx="6" {...line} stroke={i === 0 ? C.green : C.chalk} />
            {lines.map((l, j) => (
              <Label key={j} x={x} y={y + 4 + (j - (lines.length - 1) / 2) * 12} size={11}>
                {l}
              </Label>
            ))}
          </g>
        );
      })}
      {spots.slice(1).map((to, i) => {
        const from = spots[i];
        if (from.y !== to.y) {
          return (
            <g key={i}>
              <path d={`M${from.x} ${from.y + 16} L${to.x} ${to.y - 16}`} {...line} stroke={C.yellow} />
              <Arrow x={to.x} y={to.y - 17} angle={90} />
            </g>
          );
        }
        const dir = to.x > from.x ? 1 : -1;
        const x1 = from.x + dir * 40;
        const x2 = to.x - dir * 40;
        return (
          <g key={i}>
            <path d={`M${x1} ${from.y} L${x2} ${to.y}`} {...line} stroke={C.yellow} />
            <Arrow x={x2} y={to.y} angle={dir > 0 ? 0 : 180} />
          </g>
        );
      })}
    </>
  );
}

export type TemplateDrawing = { template: string; params: Record<string, unknown> };

export function TemplateArt({ template, params }: TemplateDrawing) {
  let art: React.ReactNode = null;
  if (template === "magnets") art = <Magnets {...(params as MagnetParams)} />;
  if (template === "circuit") art = <Circuit {...(params as { kind: "series" | "parallel"; count: number; bulb: boolean })} />;
  if (template === "wire_field") art = <WireField {...(params as { current: "up" | "down" })} />;
  if (template === "ray") art = <Ray {...(params as { kind: "air-glass" | "glass-air" | "reflection" })} />;
  if (template === "flow") art = <Flow steps={(params.steps as string[]) ?? []} />;
  if (!art) return null;
  return (
    <svg viewBox="0 0 280 140" className="chalk-draw h-full max-h-56 w-full" aria-hidden>
      {art}
    </svg>
  );
}

export const templateSamples: TemplateDrawing[] = [
  { template: "magnets", params: { left: "N", right: "N" } },
  { template: "magnets", params: { left: "S", right: "S" } },
  { template: "magnets", params: { left: "N", right: "S" } },
  { template: "circuit", params: { kind: "series", count: 3, bulb: true } },
  { template: "circuit", params: { kind: "parallel", count: 3, bulb: false } },
  { template: "wire_field", params: { current: "up" } },
  { template: "ray", params: { kind: "air-glass" } },
  { template: "ray", params: { kind: "glass-air" } },
  { template: "ray", params: { kind: "reflection" } },
  { template: "flow", params: { steps: ["Mouth", "Oesophagus", "Stomach", "Small intestine", "Large intestine", "Anus"] } },
];
