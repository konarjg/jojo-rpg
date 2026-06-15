#!/usr/bin/env python3
"""Extract rulebook HTML tables into RULES JSON inlined in character-builder.html."""

import json
import os
import re
from html import unescape

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML_DIR = os.path.join(BASE_DIR, "html")
BUILDER_PATH = os.path.join(BASE_DIR, "sheets", "character-builder.html")
RULES_START = "<!-- RULES:START -->"
RULES_END = "<!-- RULES:END -->"


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def strip_tags(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    return unescape(text).strip()


def slugify(name: str) -> str:
    slug = name.lower()
    slug = slug.replace("!", "")
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def parse_perk_requirements(raw: str) -> dict:
    raw = raw.strip()
    if raw in ("—", "-", ""):
        return {"attributes": {}, "levelMin": None, "race": None, "notes": None}
    result: dict = {"attributes": {}, "levelMin": None, "race": None, "notes": raw}
    level_match = re.search(r"Lvl\s*(\d+)\+", raw, re.I)
    if level_match:
        result["levelMin"] = int(level_match.group(1))
    if "vampire" in raw.lower():
        result["race"] = "vampire"
    for match in re.finditer(r"\b(STR|PER|END|CHA|INT|AGI|LCK)\s*(\d+)", raw, re.I):
        result["attributes"][match.group(1).upper()] = int(match.group(2))
    return result


def parse_skills(html: str) -> list[dict]:
    skills: list[dict] = []
    table_match = re.search(r"<h2>Skills</h2>\s*<table>(.*?)</table>", html, re.S)
    if not table_match:
        return skills
    rows = re.findall(r"<tr>(.*?)</tr>", table_match.group(1), re.S)
    for row in rows[1:]:
        cells = [strip_tags(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        pairs: list[tuple[str, str]] = []
        idx = 0
        while idx < len(cells):
            if idx + 1 < len(cells) and cells[idx] and cells[idx + 1]:
                pairs.append((cells[idx], cells[idx + 1]))
                idx += 2
            elif idx + 2 < len(cells) and not cells[idx] and cells[idx + 1] and cells[idx + 2]:
                pairs.append((cells[idx + 1], cells[idx + 2]))
                idx += 3
            else:
                idx += 1
        for name, attr in pairs:
            locked = "hamon" in name.lower() or "spin" in name.lower()
            clean_name = re.sub(r"\*+$", "", name).replace("**", "").strip()
            skills.append(
                {
                    "id": slugify(clean_name),
                    "name": clean_name,
                    "attribute": attr,
                    "locked": locked,
                }
            )
    return skills


def parse_traits(html: str) -> dict:
    human: list[dict] = []
    table_match = re.search(
        r"<h3>Human</h3>\s*<p>.*?</p>\s*<table>(.*?)</table>", html, re.S
    )
    if table_match:
        rows = re.findall(r"<tr>(.*?)</tr>", table_match.group(1), re.S)
        for row in rows[1:]:
            cells = [strip_tags(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
            if len(cells) >= 3:
                human.append(
                    {
                        "id": slugify(cells[0]),
                        "name": cells[0],
                        "benefit": cells[1],
                        "penalty": cells[2] if cells[2] != "—" else None,
                    }
                )
    vampire = {
        "id": "immortal-blood",
        "name": "Immortal Blood",
        "benefits": [
            "Regenerate 1 HP end of combat round (not in sunlight); 2 if last damaged by Hamon",
            "Sunlight and Hamon ignore DR; sunlight = energy Persistent",
            "Cannot learn Hamon; Spin only with GM approval",
            "Max CHA/PER 10; +1 physical DR all locations",
        ],
    }
    return {"human": human, "vampire": vampire}


def parse_perks(html: str) -> list[dict]:
    perks: list[dict] = []
    table_match = re.search(r"<h2>Perks</h2>.*?<table>(.*?)</table>", html, re.S)
    if not table_match:
        return perks
    rows = re.findall(r"<tr>(.*?)</tr>", table_match.group(1), re.S)
    for row in rows[1:]:
        cells = [strip_tags(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if len(cells) < 4:
            continue
        name = cells[0]
        reqs = parse_perk_requirements(cells[2])
        if "vampire" in cells[3].lower():
            reqs["race"] = "vampire"
        if name == "Hamon Strike":
            reqs["requiresHamon"] = True
        perks.append(
            {
                "id": slugify(name),
                "name": name,
                "ranks": int(cells[1]) if cells[1].isdigit() else 1,
                "requirements": reqs,
                "effect": cells[3],
            }
        )
    return perks


def parse_weapon_table(html: str, heading: str, category: str) -> list[dict]:
    weapons: list[dict] = []
    pattern = rf"<h2>{re.escape(heading)}</h2>\s*<table>(.*?)</table>"
    table_match = re.search(pattern, html, re.S)
    if not table_match:
        return weapons
    rows = re.findall(r"<tr>(.*?)</tr>", table_match.group(1), re.S)
    headers = [strip_tags(h).lower() for h in re.findall(r"<th[^>]*>(.*?)</th>", rows[0], re.S)]
    for row in rows[1:]:
        cells = [strip_tags(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if not cells:
            continue
        item: dict = {"category": category, "id": slugify(cells[0]), "name": cells[0]}
        for idx, header in enumerate(headers):
            if idx >= len(cells):
                break
            value = cells[idx]
            if header == "weapon" or header == "item":
                continue
            if header == "damage":
                item["damage"] = value
            elif header == "effects":
                item["effects"] = value if value != "—" else None
            elif header == "range":
                item["range"] = value
            elif header == "fr":
                item["fireRate"] = int(value) if value.isdigit() else value
            elif header == "rarity":
                item["rarity"] = value
            elif header == "cost":
                item["cost"] = int(value) if value.isdigit() else value
            elif header == "notes":
                item["notes"] = value
        weapons.append(item)
    return weapons


def parse_armor(html: str) -> list[dict]:
    armor: list[dict] = []
    table_match = re.search(r"<h2>Armor</h2>\s*<table>(.*?)</table>", html, re.S)
    if not table_match:
        return armor
    rows = re.findall(r"<tr>(.*?)</tr>", table_match.group(1), re.S)
    for row in rows[1:]:
        cells = [strip_tags(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if len(cells) < 5:
            continue
        locations = cells[3]
        loc_list: list[str] = []
        if locations.lower() == "all":
            loc_list = ["head", "torso", "arm", "leg"]
        elif locations != "—":
            loc_map = {"arms": "arm", "arm": "arm", "torso": "torso", "head": "head", "leg": "leg", "legs": "leg"}
            for part in re.split(r",\s*", locations):
                key = part.lower().strip()
                if key in loc_map:
                    loc_list.append(loc_map[key])
        armor.append(
            {
                "id": slugify(cells[0]),
                "name": cells[0],
                "physicalDr": int(cells[1]) if cells[1].isdigit() else 0,
                "energyDr": int(cells[2]) if cells[2].isdigit() else 0,
                "locations": loc_list,
                "rarity": int(cells[4]) if cells[4].isdigit() else cells[4],
            }
        )
    return armor


def parse_consumables(html: str) -> list[dict]:
    items: list[dict] = []
    table_match = re.search(r"<h2>Consumables</h2>\s*<table>(.*?)</table>", html, re.S)
    if not table_match:
        return items
    rows = re.findall(r"<tr>(.*?)</tr>", table_match.group(1), re.S)
    for row in rows[1:]:
        cells = [strip_tags(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if len(cells) < 4:
            continue
        item = {
            "id": slugify(cells[0]),
            "name": cells[0],
            "effect": cells[1],
            "rarity": cells[2],
            "cost": cells[3],
            "vampireOnly": "vampire" in cells[1].lower(),
        }
        items.append(item)
    return items


def parse_xp_table(html: str) -> list[dict]:
    table: list[dict] = []
    table_match = re.search(r"<h2>Level &amp; Experience</h2>\s*<table>(.*?)</table>", html, re.S)
    if not table_match:
        return table
    rows = re.findall(r"<tr>(.*?)</tr>", table_match.group(1), re.S)
    for row in rows[1:]:
        cells = [strip_tags(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if len(cells) >= 2 and cells[0].isdigit() and cells[1].isdigit():
            table.append({"level": int(cells[0]), "xp": int(cells[1])})
        if len(cells) >= 4 and cells[2].isdigit() and cells[3].isdigit():
            table.append({"level": int(cells[2]), "xp": int(cells[3])})
    return sorted(table, key=lambda entry: entry["level"])


def build_rules() -> dict:
    ch3 = read_file(os.path.join(HTML_DIR, "03-character-creation.html"))
    ch4 = read_file(os.path.join(HTML_DIR, "04-equipment.html"))
    ch8 = read_file(os.path.join(HTML_DIR, "08-appendices.html"))

    weapons: list[dict] = []
    weapons.extend(parse_weapon_table(ch4, "Small Guns", "small_guns"))
    weapons.extend(parse_weapon_table(ch4, "Big Guns", "big_guns"))
    weapons.extend(parse_weapon_table(ch4, "Energy Weapons", "energy"))
    weapons.extend(parse_weapon_table(ch4, "Melee Weapons", "melee"))
    weapons.extend(parse_weapon_table(ch4, "Explosives", "explosives"))

    armor = parse_armor(ch4)
    consumables = parse_consumables(ch4)

    books = [
        {"id": "hamon-manual", "name": "Hamon Manual", "effect": "+1 Hamon test (one-time)"},
        {"id": "gunsmith-weekly", "name": "Gunsmith Weekly", "effect": "+1 Repair for guns (one-time)"},
        {"id": "spin-atlas", "name": "Spin Atlas", "effect": "Counts toward Spin training"},
    ]

    return {
        "version": 1,
        "skills": parse_skills(ch3),
        "traits": parse_traits(ch3),
        "perks": parse_perks(ch3),
        "weapons": weapons,
        "armor": armor,
        "consumables": consumables,
        "books": books,
        "standGrades": {"∞": 12, "A": 10, "B": 8, "C": 6, "D": 4, "E": 2, "?": 6, "∅": 0},
        "standStats": ["power", "speed", "range", "durability", "precision", "developmentPotential"],
        "standTypes": ["Close-Range", "Remote", "Automatic", "Colony", "Tool"],
        "formulas": {
            "standBudget": "41 + ceil(level / 2)",
            "hp": "END + LCK + level",
            "initiative": "PER + AGI",
            "defense": "1 if AGI <= 8 else 2",
            "carryWeight": "150 + STR * 10",
            "smallFrameCarry": "150 + STR * 5",
        },
        "xpTable": parse_xp_table(ch8),
        "xpFormula21Plus": "(level * (level - 1) / 2) * 100",
        "advancement": {"perLevel": {"hp": 1, "skillRanks": 1, "perks": 1}},
        "races": {
            "human": {"id": "human", "name": "Human", "maxTraits": 2, "bonusPerkOption": True},
            "vampire": {"id": "vampire", "name": "Vampire", "hamonLocked": True, "chaPerMax": 10, "physicalDrBonus": 1},
        },
        "specialAttributes": ["STR", "PER", "END", "CHA", "INT", "AGI", "LCK"],
    }


def inline_rules(builder_html: str, rules: dict) -> str:
    json_block = json.dumps(rules, ensure_ascii=False, indent=2)
    replacement = (
        f"{RULES_START}\n"
        f'<script id="jojo-rules" type="application/json">\n{json_block}\n</script>\n'
        f"{RULES_END}"
    )
    pattern = re.compile(
        re.escape(RULES_START) + r".*?" + re.escape(RULES_END),
        re.S,
    )
    if pattern.search(builder_html):
        return pattern.sub(replacement, builder_html)
    return builder_html.replace("</body>", f"{replacement}\n</body>")


def main() -> None:
    if not os.path.exists(BUILDER_PATH):
        raise FileNotFoundError(
            f"Missing {BUILDER_PATH}. Create character-builder.html shell first."
        )
    rules = build_rules()
    builder_html = read_file(BUILDER_PATH)
    updated = inline_rules(builder_html, rules)
    with open(BUILDER_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(updated)
    print(f"Inlined RULES into {BUILDER_PATH}")
    print(f"  perks: {len(rules['perks'])}")
    print(f"  skills: {len(rules['skills'])}")
    print(f"  weapons: {len(rules['weapons'])}")


if __name__ == "__main__":
    main()
