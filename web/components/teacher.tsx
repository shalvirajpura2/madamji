import type { Mood } from "@/lib/lesson";

export type TeacherPose = "speaking" | "listening" | "thinking" | "idle";

type Props = {
  mood?: Mood;
  pose?: TeacherPose;
  level?: number; // voice loudness 0..1, opens the mouth while speaking
  className?: string;
  wave?: boolean;
};

const SKIN = "#c98e60";
const SKIN_SHADE = "#b57a4d";
const HAIR = "#1f1612";

const BROWS: Record<string, [string, string]> = {
  default: ["M73 79 Q84 74 94 78", "M106 78 Q116 74 127 79"],
  happy: ["M73 77 Q84 70 94 75", "M106 75 Q116 70 127 77"],
  concerned: ["M73 80 Q84 78 94 74", "M106 74 Q116 78 127 80"],
  curious: ["M73 79 Q84 75 94 78", "M106 75 Q116 68 127 74"],
  encouraging: ["M73 78 Q84 72 94 76", "M106 76 Q116 72 127 78"],
};

function brows(mood: Mood) {
  if (mood === "happy" || mood === "proud") return BROWS.happy;
  if (mood === "concerned" || mood === "kind") return BROWS.concerned;
  if (mood === "curious" || mood === "listening") return BROWS.curious;
  if (mood === "encouraging") return BROWS.encouraging;
  return BROWS.default;
}

function Mouth({ mood, pose, level }: { mood: Mood; pose: TeacherPose; level: number }) {
  const open = pose === "speaking" ? Math.min(1, level * 2.4) : 0;
  if (open > 0.08) {
    const depth = 121 + open * 11;
    return (
      <g>
        <path d={`M88 118 Q100 ${depth} 112 118 Q100 120 88 118Z`} fill="#6e2424" />
        <path d={`M93 ${118 + open * 5} Q100 ${depth - 1.5} 107 ${118 + open * 5}`} fill="#d9726f" opacity={open > 0.4 ? 1 : 0} />
      </g>
    );
  }
  if (mood === "happy" || mood === "proud") {
    return (
      <g>
        <path d="M86 116 Q100 132 114 116 Q100 121 86 116Z" fill="#6e2424" />
        <path d="M90 117.5 Q100 121 110 117.5 L109 119.5 Q100 122 91 119.5Z" fill="#fff" />
      </g>
    );
  }
  if (mood === "concerned") {
    return <path d="M91 121 Q100 118 109 121" stroke="#6e2424" strokeWidth="2.6" fill="none" strokeLinecap="round" />;
  }
  if (pose === "thinking") {
    return <path d="M93 120 Q101 119 108 117" stroke="#6e2424" strokeWidth="2.6" fill="none" strokeLinecap="round" />;
  }
  return <path d="M88 118 Q100 127 112 118" stroke="#6e2424" strokeWidth="2.8" fill="none" strokeLinecap="round" />;
}

export function Teacher({ mood = "calm", pose = "idle", level = 0, className = "", wave = false }: Props) {
  const [leftBrow, rightBrow] = brows(mood);
  const lookUp = pose === "thinking" ? -2 : 0;
  const tilt = pose === "listening" ? -5 : pose === "thinking" ? 4 : 0;
  const pointing = pose === "speaking" && (mood === "explaining" || mood === "curious");
  const blush = mood === "happy" || mood === "proud" ? 0.55 : 0.28;

  return (
    <svg viewBox="0 0 200 260" className={className} role="img" aria-label={`Meera Ma'am, ${pose}`}>
      {/* raised arm with chalk, drawn behind the body */}
      <g
        style={{
          transformOrigin: "142px 172px",
          transform: wave ? "rotate(-8deg)" : pointing ? "rotate(0deg)" : "rotate(152deg)",
          opacity: wave || pointing ? 1 : 0,
          transition: "transform 0.5s ease, opacity 0.3s ease",
        }}
        className={wave ? "animate-wiggle" : undefined}
      >
        <path d="M142 172 Q166 150 172 120" stroke="#1f8a7a" strokeWidth="17" strokeLinecap="round" fill="none" />
        <circle cx="173" cy="114" r="9" fill={SKIN} />
        <rect x="170" y="94" width="6" height="16" rx="2" fill="#fbfaf4" transform="rotate(12 173 102)" />
      </g>

      {/* body: blouse, saree pallu with border, necklace */}
      <path d="M46 260 Q48 176 78 157 Q100 149 122 157 Q152 176 154 260Z" fill="#1f8a7a" />
      <path d="M70 160 Q97 150 128 163 L154 238 L136 260 L106 260 Q99 210 70 160Z" fill="#f5a524" />
      <path d="M128 163 L154 238 L148 245 L123 168Z" fill="#c2185b" />
      <path d="M86 156 Q100 170 114 156" stroke="#e8b84a" strokeWidth="2.4" fill="none" strokeDasharray="0.1 4.4" strokeLinecap="round" />

      <g
        style={{ transformOrigin: "100px 150px", transform: `rotate(${tilt}deg)`, transition: "transform 0.6s ease" }}
      >
        {/* neck */}
        <path d="M90 128 L90 152 Q100 158 110 152 L110 128Z" fill={SKIN_SHADE} />

        {/* hair back and bun */}
        <ellipse cx="100" cy="86" rx="47" ry="53" fill={HAIR} />
        <circle cx="100" cy="34" r="17" fill={HAIR} />
        <path d="M86 40 Q100 32 114 40" stroke="#e85d75" strokeWidth="3" fill="none" strokeLinecap="round" />

        {/* ears and earrings */}
        <ellipse cx="60" cy="97" rx="6" ry="10" fill={SKIN_SHADE} />
        <ellipse cx="140" cy="97" rx="6" ry="10" fill={SKIN_SHADE} />
        <circle cx="60" cy="111" r="3" fill="#f2c14e" />
        <circle cx="140" cy="111" r="3" fill="#f2c14e" />

        {/* face */}
        <ellipse cx="100" cy="94" rx="40" ry="46" fill={SKIN} />
        <path d="M60 82 Q62 44 100 42 Q138 44 140 82 Q132 58 102 56 Q99 52 98 56 Q70 58 60 82Z" fill={HAIR} />

        {/* cheeks */}
        <circle cx="78" cy="111" r="6.5" fill="#ef7f7a" opacity={blush} />
        <circle cx="122" cy="111" r="6.5" fill="#ef7f7a" opacity={blush} />

        {/* eyes */}
        {mood === "happy" || mood === "proud" ? (
          <g stroke="#3b2414" strokeWidth="2.6" fill="none" strokeLinecap="round">
            <path d="M78 95 Q84 89 90 95" />
            <path d="M110 95 Q116 89 122 95" />
          </g>
        ) : (
          <g className="eye-blink">
            <ellipse cx="84" cy="94" rx="7" ry="5.6" fill="#fff" />
            <ellipse cx="116" cy="94" rx="7" ry="5.6" fill="#fff" />
            <circle cx="84" cy={94 + lookUp} r="3.7" fill="#3b2414" />
            <circle cx="116" cy={94 + lookUp} r="3.7" fill="#3b2414" />
            <circle cx="85.3" cy={92.6 + lookUp} r="1.1" fill="#fff" />
            <circle cx="117.3" cy={92.6 + lookUp} r="1.1" fill="#fff" />
          </g>
        )}

        {/* glasses */}
        <g stroke="#5a3b2a" strokeWidth="2.2" fill="none">
          <circle cx="84" cy="94" r="12" />
          <circle cx="116" cy="94" r="12" />
          <path d="M96 93 Q100 90 104 93" />
        </g>

        {/* brows, bindi, nose, mouth */}
        <g stroke={HAIR} strokeWidth="3" fill="none" strokeLinecap="round" style={{ transition: "d 0.3s" }}>
          <path d={leftBrow} />
          <path d={rightBrow} />
        </g>
        <circle cx="100" cy="74" r="2.7" fill="#d62839" />
        <path d="M100 99 Q96.5 108 101 110" stroke={SKIN_SHADE} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <Mouth mood={mood} pose={pose} level={level} />
      </g>

      {/* thinking dots */}
      {pose === "thinking" && (
        <g fill="#fffdf8" stroke="#ead8bd" strokeWidth="1.5">
          <circle cx="150" cy="52" r="4" className="animate-pulse" />
          <circle cx="162" cy="38" r="6" className="animate-pulse [animation-delay:0.2s]" />
          <circle cx="178" cy="20" r="9" className="animate-pulse [animation-delay:0.4s]" />
        </g>
      )}
      {/* listening waves near the ear */}
      {pose === "listening" && (
        <g stroke="#4c9be8" strokeWidth="2.4" fill="none" strokeLinecap="round" className="animate-pulse">
          <path d="M44 88 Q38 97 44 106" />
          <path d="M36 82 Q27 97 36 112" />
        </g>
      )}
    </svg>
  );
}
