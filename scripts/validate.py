#!/usr/bin/env python3
"""Credential-free source/fixture validation; does not claim to compile Swift."""
import json
import pathlib
import plistlib
import re
import struct

ROOT = pathlib.Path(__file__).resolve().parents[1]
world = json.loads((ROOT / "AntFarm/Resources/reference-world.json").read_text())
assert world["width"] > 0 and world["height"] > 0
assert len(world["ants"]) == 14
assert len({a["id"] for a in world["ants"]}) == len(world["ants"])
assert any(a["id"] == "C-027" for a in world["ants"])
assert any(a["caste"] == "Queen" for a in world["ants"])
for ant in world["ants"]:
    assert 0 <= ant["x"] <= world["width"] and 0 <= ant["y"] <= world["height"]
    assert all(0 <= ant[key] <= 100 for key in ("health", "energy", "hydration"))
    assert ant["ageDays"] >= 0
for point in world["trail"]:
    assert 0 <= point["x"] <= world["width"] and 0 <= point["y"] <= world["height"]
png = ROOT / "AntFarm/Resources" / (world["image"] + ".png")
with png.open("rb") as stream:
    header = stream.read(24)
assert header[:8] == b"\x89PNG\r\n\x1a\n"
assert struct.unpack(">II", header[16:24]) == (world["width"], world["height"])
info = plistlib.loads((ROOT / "AntFarm/Info.plist").read_bytes())
assert set(info["UISupportedInterfaceOrientations"]) == {
    "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"}
project = (ROOT / "AntFarm.xcodeproj/project.pbxproj").read_text()
for source in ROOT.glob("AntFarm/**/*.swift"):
    assert source.name in project, f"Unreferenced Swift source: {source}"
for relative in re.findall(r'path = "([^"]+)";', project):
    assert (ROOT / relative).exists(), f"Missing project path: {relative}"
for doc in ROOT.glob("docs/**/*.md"):
    for target in re.findall(r'\]\(([^)]+)\)', doc.read_text()):
        if not target.startswith(("https://", "#")):
            assert (doc.parent / target).exists(), f"Broken link: {doc}: {target}"
print(f"Validated {len(world['ants'])} ant fixtures, image dimensions, landscape settings, project references, and document links.")
