from ustaad_agent.drawing import DIAGRAMS, sanitize

GOOD = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 140" width="900">
  <rect x="20" y="40" width="90" height="26" stroke="chalk" fill="none" stroke-width="2.5"/>
  <line x1="65" y1="40" x2="65" y2="66" stroke="yellow"/>
  <text x="42" y="58" fill="pink" font-size="14">N</text>
  <path d="M10 10 L40 40" stroke="#ff0000"/>
</svg>"""


def test_keeps_shapes_labels_and_chalk_colours():
    out = sanitize(GOOD)
    assert out is not None
    assert "<rect" in out and "<line" in out and ">N</text>" in out
    assert 'stroke="yellow"' in out and 'fill="pink"' in out
    assert "#ff0000" not in out and 'stroke="chalk"' in out  # unknown colours become chalk
    assert 'width="900"' not in out


def test_strips_scripts_links_events_and_styles():
    evil = """<svg viewBox="0 0 280 140">
      <script>alert(1)</script>
      <a href="javascript:alert(1)"><circle cx="5" cy="5" r="3"/></a>
      <circle cx="10" cy="10" r="5" onclick="alert(1)" style="fill:red" fill="url(#x)"/>
      <image href="http://evil/x.png"/>
      <foreignObject><div>hi</div></foreignObject>
      <line x1="0" y1="0" x2="10" y2="10"/>
      <rect x="1" y="1" width="2" height="2"/>
    </svg>"""
    out = sanitize(evil)
    assert out is not None
    for bad in ("script", "alert", "href", "onclick", "style", "url(", "image", "foreignObject", "<a"):
        assert bad not in out


def test_rejects_garbage_and_huge_input():
    assert sanitize("not svg at all") is None
    assert sanitize("<div><circle/></div>") is None
    assert sanitize("<svg>" + "<line/>" * 5000 + "</svg>") is None


def test_reviewed_diagram_catalog_matches_the_web_app():
    from pathlib import Path

    web = (Path(__file__).resolve().parents[2] / "web" / "components" / "room" / "diagrams.tsx").read_text(encoding="utf-8")
    for diagram_id in DIAGRAMS:
        assert f'"{diagram_id}"' in web or f"{diagram_id}:" in web, diagram_id


def test_template_options_are_checked():
    from ustaad_agent.drawing import template_params as tp

    assert tp("magnets", "N-N") == {"left": "N", "right": "N"}
    assert tp("magnets", "s - n") == {"left": "S", "right": "N"}
    assert tp("magnets", "north north") is None
    assert tp("circuit", "parallel 3 bulb") == {"kind": "parallel", "count": 3, "bulb": True}
    assert tp("circuit", "series") == {"kind": "series", "count": 2, "bulb": False}
    assert tp("circuit", "a circuit") is None
    assert tp("wire_field", "current down") == {"current": "down"}
    assert tp("ray", "refraction glass-air") == {"kind": "glass-air"}
    assert tp("ray", "refraction air to glass") == {"kind": "air-glass"}
    assert tp("ray", "reflection on a mirror") == {"kind": "reflection"}
    assert tp("flow", "Mouth > Stomach > Small <b>intestine</b>")["steps"][:2] == ["Mouth", "Stomach"]
    assert tp("flow", "just one") is None


def test_background_rect_is_dropped():
    out = sanitize('<svg viewBox="0 0 280 140"><rect x="0" y="0" width="280" height="140" fill="green"/>'
                   '<line x1="1" y1="1" x2="9" y2="9"/><circle cx="5" cy="5" r="2"/></svg>')
    assert out is not None and "<rect" not in out
