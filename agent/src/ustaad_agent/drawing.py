"""Drawing on the chalkboard when a student asks.

First choice is one of our reviewed diagrams. Otherwise a model sketches a simple chalk-style SVG,
which is cleaned here with a strict allowlist (and again in the browser) before it reaches the board."""

import logging
import re
import xml.etree.ElementTree as ET

from .config import settings
from .models import ask_json

logger = logging.getLogger("ustaad.drawing")

# reviewed diagrams the web app can draw, with what each one shows
DIAGRAMS = {
    "magnet-shapes": "shapes of magnets: bar, horseshoe (U) and ring magnet",
    "bar-magnet-filings": "iron filings sticking mostly at the two poles of a bar magnet",
    "compass": "a compass with its needle pointing north",
    "attract-repel": "unlike poles attract, like poles repel, with two bar magnets",
    "food-plate": "a balanced Indian thali: roti, dal, sabzi, curd, salad",
    "iodine-test": "starch test: iodine turns food with starch blue-black",
    "states-of-water": "three states of water: ice, liquid water, water vapour",
    "water-cycle": "the water cycle: evaporation, clouds, rain",
    "simple-circuit": "a simple circuit with cell, bulb, ammeter in series and voltmeter across the bulb",
    "vi-graph": "Ohm's law V-I graph, a straight line whose slope is R",
    "series-parallel": "resistors in series and in parallel with their formulas",
    "field-lines": "magnetic field lines around a bar magnet, from N to S",
    "solenoid": "a solenoid coil with a uniform field inside, like a bar magnet",
    "photosynthesis": "a leaf taking in CO2 and water with sunlight, giving out O2 and making glucose",
    "respiration-pathways": "glucose to pyruvate, then yeast, muscle and aerobic pathways",
}

# science drawings the web app draws by code, so the physics is right by construction
TEMPLATES = {
    "magnets": "two bar magnets facing each other; options: the facing poles, N-N, S-S or N-S",
    "circuit": "a circuit with a cell; options: series or parallel, 2 or 3 resistors, optionally 'bulb'",
    "wire_field": "magnetic field around a straight wire carrying current; options: current up or down",
    "ray": "a light ray; options: refraction air-glass, refraction glass-air, or reflection",
    "flow": "a labelled chain of steps; options: up to 6 short steps separated by >, like 'Mouth > Stomach > Small intestine'",
}


# what each chapter may draw; anything else is off the chapter and never drawn
CHAPTER_DRAWINGS = {
    "g6-magnets": (("magnet-shapes", "bar-magnet-filings", "compass", "attract-repel"), ("magnets", "flow")),
    "g6-food": (("food-plate", "iodine-test"), ("flow",)),
    "g6-water": (("states-of-water", "water-cycle"), ("flow",)),
    "g10-electricity": (("simple-circuit", "vi-graph", "series-parallel"), ("circuit", "flow")),
    "g10-magnetic-effects": (("field-lines", "solenoid", "compass"), ("magnets", "wire_field", "circuit", "flow")),
    "g10-life-processes": (("photosynthesis", "respiration-pathways"), ("flow",)),
}


def for_chapter(chapter_id: str) -> tuple[dict[str, str], dict[str, str]]:
    """The reviewed diagrams and drawing templates this chapter may use."""
    diagrams, templates = CHAPTER_DRAWINGS.get(chapter_id, ((), ("flow",)))
    return {d: DIAGRAMS[d] for d in diagrams}, {t: TEMPLATES[t] for t in templates}


def template_params(template: str, options: str) -> dict | None:
    """Turn the teacher's options into checked settings for a drawing template."""
    text = (options or "").strip()
    low = text.lower()
    if template == "magnets":
        m = re.match(r"^\s*([ns])\s*[-–/ ]\s*([ns])\s*$", low)
        return {"left": m.group(1).upper(), "right": m.group(2).upper()} if m else None
    if template == "circuit":
        kind = "parallel" if "parallel" in low else "series" if "series" in low else None
        count = 3 if re.search(r"\b(3|three)\b", low) else 2
        return {"kind": kind, "count": count, "bulb": "bulb" in low} if kind else None
    if template == "wire_field":
        direction = "down" if "down" in low else "up" if "up" in low else None
        return {"current": direction} if direction else None
    if template == "ray":
        if "reflect" in low:
            return {"kind": "reflection"}
        if "refract" in low:
            glass, air = low.find("glass"), low.find("air")
            return {"kind": "glass-air" if glass != -1 and (air == -1 or glass < air) else "air-glass"}
        return None
    if template == "flow":
        steps = [re.sub(r"[^\w ,'()-]", "", x).strip()[:24] for x in text.split(">")]
        steps = [x for x in steps if x][:6]
        return {"steps": steps} if len(steps) >= 2 else None
    return None


ALLOWED_TAGS = {"svg", "g", "line", "polyline", "polygon", "path", "circle", "ellipse", "rect", "text"}
ALLOWED_ATTRS = {
    "viewBox", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "d", "points",
    "fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "font-size",
    "text-anchor", "transform", "opacity",
}
COLORS = {"chalk", "yellow", "pink", "blue", "green", "none"}
SAFE_VALUE = re.compile(r"^[a-zA-Z0-9 .,#%()\-]*$")
MAX_ELEMENTS = 150

PROMPT = """You draw quick chalkboard sketches for a science teacher in an Indian school. Draw: {what}
The student is in class {grade}. Keep it simple, clear and scientifically correct, like a teacher's chalk drawing.

First think like a science teacher: list the 2 to 4 key scientific facts the picture must show correctly
(for example, which way field lines or current go, which way a ray bends, what attracts or repels).
Then draw so that every fact holds. If you cannot draw it correctly, return an empty svg.
Keep it to simple labelled pictures of objects, setups or steps; do not draw field lines or anything whose
direction must be exact.

Reply as JSON: {{"facts": ["..."], "title": "a few words", "svg": "<svg ...>...</svg>"}}
SVG rules:
- viewBox="0 0 280 140", no width or height on the svg element.
- Only these elements: g, line, polyline, polygon, path, circle, ellipse, rect, text.
- Colours only by these names in fill or stroke: chalk, yellow, pink, blue, green, or none. The board is dark green.
- Lines: stroke-width 2 to 3, stroke-linecap round, fill none for outlines.
- Text: short labels only (max 8), font-size 11 to 15, inside the viewBox.
- Use arrows (small polylines) to show direction where it matters (current, field, flow, rays).
- No styles, classes, ids, scripts, images, links or gradients."""


def sanitize(svg: str) -> str | None:
    """Keep only plain shapes, labels and our chalk colours. Returns None if nothing safe is left."""
    if not svg or len(svg) > 20000:
        return None
    try:
        root = ET.fromstring(svg.strip())
    except ET.ParseError:
        return None

    count = 0

    def clean(el: ET.Element) -> ET.Element | None:
        nonlocal count
        tag = el.tag.split("}")[-1]
        if tag not in ALLOWED_TAGS or count >= MAX_ELEMENTS:
            return None
        count += 1
        out = ET.Element(tag)
        for key, value in el.attrib.items():
            key = key.split("}")[-1]
            if key not in ALLOWED_ATTRS or not SAFE_VALUE.match(value) or "url" in value.lower():
                continue
            if key in ("fill", "stroke"):
                value = value.strip().lower()
                if value not in COLORS:
                    value = "chalk" if key == "stroke" else "none"
            out.set(key, value)
        if tag == "text":
            out.text = (el.text or "").strip()[:40]
        for child in el:
            kept = clean(child)
            if kept is not None:
                out.append(kept)
        return out

    cleaned = clean(root)
    # drop full-board background rectangles, the board is already a chalkboard
    for child in list(cleaned if cleaned is not None else []):
        if child.tag == "rect":
            try:
                w, h = float(child.get("width", "0")), float(child.get("height", "0"))
            except ValueError:
                continue
            if w >= 240 and h >= 110:
                cleaned.remove(child)
    if cleaned is None or cleaned.tag != "svg" or count < 3:
        return None
    for size in ("width", "height", "transform"):
        cleaned.attrib.pop(size, None)
    cleaned.set("viewBox", "0 0 280 140")
    return ET.tostring(cleaned, encoding="unicode")


async def sketch(what: str, grade: int) -> dict | None:
    reply = await ask_json(PROMPT.format(what=what.strip()[:200], grade=grade), timeout=14, model=settings.sketch_model)
    if not reply:
        return None
    svg = sanitize(str(reply.get("svg", "")))
    if svg is None:
        logger.warning("sketch rejected for %r", what)
        return None
    facts = [str(f)[:160] for f in (reply.get("facts") or [])][:4]
    return {"title": str(reply.get("title") or what)[:60], "svg": svg, "facts": facts}
