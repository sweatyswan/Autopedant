#!/usr/bin/env python3
"""Mechanika sheets → Autopedant workshop JSON + SQL. Fiat evidencia is not service data."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".py-xlsx"))

import openpyxl  # noqa: E402

SOURCE = ROOT / "Servisné intervaly.xlsx"
OUT_DIR = ROOT / "data" / "import"

VIN_RE = re.compile(r"[A-HJ-NPR-Z0-9]{17}")
OIL_VISC_RE = re.compile(r"\d+\s*W\s*\d+", re.I)
QTY_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(l|litre|litra|litrov|L)\b", re.I)


def slug(value: str) -> str:
    text = name_key(value).replace(" ", "-")
    return text or "x"


def norm_name(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def name_key(value: str) -> str:
    import unicodedata

    text = "".join(ch for ch in unicodedata.normalize("NFD", norm_name(value)) if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", text.casefold()).strip()


def norm_plate(value) -> str:
    if value is None:
        return ""
    text = str(value).upper().replace("=", "-")
    return re.sub(r"[^A-Z0-9]", "", text)


def norm_make(value) -> str:
    text = re.sub(r"\s+", " ", str(value or "").strip())
    fixes = {
        "lexu 300 nx": "Lexus NX 300",
        "lexus is 300": "Lexus IS 300",
        "nissan xtrail": "Nissan X-Trail",
        "nisan xtrail": "Nissan X-Trail",
        "suzuky vitara": "Suzuki Vitara",
        "vw pasat": "VW Passat",
        "seat taroco": "Seat Tarraco",
        "seat alhamra": "Seat Alhambra",
        "p 207": "Peugeot 207",
        "p 2008": "Peugeot 2008",
        "p 301": "Peugeot 301",
        "grande punto": "Fiat Grande Punto",
    }
    return fixes.get(text.casefold(), text)


def clean_comment(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"ID#[^\n]+", "", text)
    text = re.sub(r"PC\s+\([^)]+\)", "", text)
    text = re.sub(r"=+", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def cell_comment(cell) -> str:
    if not cell or not cell.comment or not cell.comment.text:
        return ""
    return clean_comment(cell.comment.text)


def extract_vin(*parts: str) -> str:
    blob = re.sub(r"\s+", "", "".join(parts).upper())
    match = VIN_RE.search(blob)
    return match.group(0) if match else ""


def parse_km(value) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        km = int(value)
        return km if km > 0 else None
    text = str(value).replace("\xa0", " ")
    text = re.sub(r"[Oo]", "0", text)
    digits = re.sub(r"\D", "", text)
    if not digits:
        return None
    km = int(digits)
    return km if km > 0 else None


def parse_money(value) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace("\xa0", " ").replace("€", "").replace(" ", "").replace(",", ".")
    if not re.fullmatch(r"-?\d+(?:\.\d+)?", text):
        return None
    return float(text)


def parse_date(value) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip().replace("_", ".")
    match = re.match(r"(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})", text)
    if match:
        day, month, year = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"
    return None


def parse_oil(text: str) -> tuple[str, str, str]:
    raw = re.sub(r"\s+", " ", str(text or "")).strip()
    if not raw:
        return "", "", ""
    qty = ""
    qty_match = QTY_RE.search(raw)
    if qty_match:
        qty = qty_match.group(1).replace(".", ",") + " l"
        raw = (raw[: qty_match.start()] + raw[qty_match.end() :]).strip()
    visc = ""
    visc_match = OIL_VISC_RE.search(raw)
    if visc_match:
        visc = re.sub(r"\s+", "", visc_match.group(0)).upper()
        raw = (raw[: visc_match.start()] + raw[visc_match.end() :]).strip(" -")
    leftover = re.sub(r"\s+", " ", raw).strip(" -")
    brand = leftover.split(" ")[0] if leftover else ""
    extra = leftover[len(brand) :].strip() if leftover else ""
    material = " ".join(part for part in [visc, extra] if part)
    return brand, material, qty


def is_ok(value) -> bool:
    return str(value or "").strip().casefold() in {"ok", "áno", "ano", "x"}


def add_item(items: list, seen: set, category: str, action: str, part: str, brand: str, material: str, qty: str):
    key = (category, action, part, brand, material, qty)
    if key in seen:
        return
    seen.add(key)
    items.append(
        {
            "id": "",
            "category": category,
            "actionType": action,
            "partName": part,
            "partBrand": brand,
            "materialType": material,
            "quantity": qty,
            "purchasePrice": 0,
            "sellPrice": 0,
        }
    )


def collect_rows(wb):
    rows = []

    ws = wb["Mechanika 2026"]
    for index, row in enumerate(ws.iter_rows(min_row=2, max_row=ws.max_row), start=2):
        name = norm_name(row[0].value)
        make = norm_make(row[1].value)
        if not name and not make:
            continue
        if name_key(name) == "meno" and name_key(make) == "znacka":
            continue
        note_bits = [str(row[10].value).strip()] if row[10].value not in (None, "") else []
        note_bits.append(cell_comment(row[10]))
        vin = extract_vin(cell_comment(row[2]), cell_comment(row[1]), cell_comment(row[0]), *note_bits)
        rows.append(
            {
                "sheet": "Mechanika 2026",
                "excelRow": index,
                "name": name,
                "make": make,
                "plate": norm_plate(row[2].value),
                "vin": vin,
                "oil": row[3].value,
                "oilFilter": is_ok(row[4].value),
                "airFilter": is_ok(row[5].value),
                "fuelFilter": is_ok(row[6].value),
                "cabinFilter": is_ok(row[7].value),
                "km": parse_km(row[8].value),
                "date": parse_date(row[9].value),
                "notes": "\n\n".join(bit for bit in note_bits if bit),
                "labor": parse_money(row[11].value),
                "material": parse_money(row[12].value),
                "laborRaw": row[11].value,
            }
        )

    ws = wb["Mechanika 2022-2025"]
    for index, row in enumerate(ws.iter_rows(min_row=2, max_row=ws.max_row), start=2):
        name = norm_name(row[0].value)
        make = norm_make(row[1].value)
        if not name and not make:
            continue
        if name_key(name) == "meno" and name_key(make) == "znacka":
            continue
        note_bits = [str(row[9].value).strip()] if row[9].value not in (None, "") else []
        note_bits.append(cell_comment(row[9]))
        vin = extract_vin(
            cell_comment(row[0]),
            cell_comment(row[1]),
            cell_comment(row[9]),
            *note_bits,
        )
        rows.append(
            {
                "sheet": "Mechanika 2022-2025",
                "excelRow": index,
                "name": name,
                "make": make,
                "plate": "",
                "vin": vin,
                "oil": row[2].value,
                "oilFilter": is_ok(row[3].value) or bool(str(row[3].value or "").strip()),
                "airFilter": is_ok(row[4].value) or bool(str(row[4].value or "").strip()),
                "fuelFilter": is_ok(row[5].value) or bool(str(row[5].value or "").strip()),
                "cabinFilter": is_ok(row[6].value) or bool(str(row[6].value or "").strip()),
                "km": parse_km(row[7].value),
                "date": parse_date(row[8].value),
                "notes": "\n\n".join(bit for bit in note_bits if bit),
                "labor": parse_money(row[10].value),
                "material": parse_money(row[11].value),
                "laborRaw": row[10].value,
            }
        )

    return rows


def build(rows: list):
    customers: dict[str, dict] = {}
    vehicles: dict[str, dict] = {}
    records: list[dict] = []
    gaps: list[dict] = []
    vehicle_by_plate: dict[str, str] = {}
    vehicle_by_pair: dict[tuple[str, str], str] = {}

    for row in rows:
        if not row["date"]:
            gaps.append(
                {
                    "reason": "bez-datumu",
                    "sheet": row["sheet"],
                    "excelRow": row["excelRow"],
                    "name": row["name"],
                    "make": row["make"],
                }
            )
            continue

        if not row["name"]:
            gaps.append(
                {
                    "reason": "bez-mena",
                    "sheet": row["sheet"],
                    "excelRow": row["excelRow"],
                    "make": row["make"],
                    "date": row["date"],
                }
            )
            continue

        if row["laborRaw"] not in (None, "") and row["labor"] is None:
            gaps.append(
                {
                    "reason": "neplatna-suma",
                    "sheet": row["sheet"],
                    "excelRow": row["excelRow"],
                    "name": row["name"],
                    "value": str(row["laborRaw"]),
                }
            )

        ckey = name_key(row["name"])
        customer_id = f"cus_{slug(ckey)}"
        customers[customer_id] = {
            "id": customer_id,
            "name": row["name"],
            "phone": "",
        }

        plate = row["plate"]
        pair = (ckey, name_key(row["make"]))
        if plate and plate in vehicle_by_plate:
            vehicle_id = vehicle_by_plate[plate]
        elif not plate and pair in vehicle_by_pair:
            vehicle_id = vehicle_by_pair[pair]
        else:
            vehicle_id = f"veh_{slug(plate or (ckey + '-' + name_key(row['make'])))}"
            if plate:
                vehicle_by_plate[plate] = vehicle_id
            vehicle_by_pair[pair] = vehicle_id
            missing = ["rok", "objem", "palivo", "prva-evidencia"]
            if not plate:
                missing.append("spz")
            if not row["vin"]:
                missing.append("vin")
            vehicles[vehicle_id] = {
                "id": vehicle_id,
                "licensePlate": plate,
                "vin": row["vin"],
                "makeModel": row["make"],
                "year": 0,
                "firstRegistrationDate": "",
                "engineDisplacement": 0,
                "fuel": "",
                "customerId": customer_id,
                "_missing": missing,
            }
            gaps.append(
                {
                    "reason": "vozidlo-doplnit",
                    "vehicleId": vehicle_id,
                    "name": row["name"],
                    "make": row["make"],
                    "plate": plate,
                    "missing": missing,
                }
            )

        vehicle = vehicles[vehicle_id]
        if row["vin"] and not vehicle["vin"]:
            vehicle["vin"] = row["vin"]
            vehicle["_missing"] = [item for item in vehicle["_missing"] if item != "vin"]
        if plate and not vehicle["licensePlate"]:
            vehicle["licensePlate"] = plate
            vehicle["_missing"] = [item for item in vehicle["_missing"] if item != "spz"]
        if row["make"] and len(row["make"]) > len(vehicle["makeModel"]):
            vehicle["makeModel"] = row["make"]

        items: list[dict] = []
        seen: set = set()
        brand, material, qty = parse_oil(row["oil"] or "")
        if row["oil"]:
            add_item(items, seen, "Motor a prevodovka", "Výmena", "Olej motorový", brand, material, qty)
        if row["oilFilter"]:
            add_item(items, seen, "Motor a prevodovka", "Výmena", "Olejový filter", "", "", "")
        if row["airFilter"]:
            add_item(items, seen, "Motor a prevodovka", "Výmena", "Vzduchový filter", "", "", "")
        if row["fuelFilter"]:
            add_item(items, seen, "Motor a prevodovka", "Výmena", "Palivový filter", "", "", "")
        if row["cabinFilter"]:
            add_item(items, seen, "Ostatné práce a diely", "Výmena", "Peľový filter", "", "", "")

        record_id = f"rec_{slug(vehicle_id + '-' + row['date'] + '-' + str(row['km'] or 0) + '-' + str(row['excelRow']))}"
        for offset, item in enumerate(items):
            item["id"] = f"item_{record_id}_{offset + 1}"

        record = {
            "id": record_id,
            "vehicleId": vehicle_id,
            "serviceDate": row["date"],
            "mileage": row["km"] or 0,
            "laborCost": row["labor"] or 0,
            "billedAmount": 0,
            "mechanicNotes": row["notes"],
            "items": items,
            "_source": f"{row['sheet']}!{row['excelRow']}",
        }
        if row["material"] is not None:
            record["materialEarnings"] = row["material"]
        if row["km"] is None:
            gaps.append(
                {
                    "reason": "bez-km",
                    "recordId": record_id,
                    "name": row["name"],
                    "date": row["date"],
                }
            )
        records.append(record)

    for vehicle in vehicles.values():
        vehicle.pop("_missing", None)

    return {
        "customers": sorted(customers.values(), key=lambda item: name_key(item["name"])),
        "vehicles": sorted(vehicles.values(), key=lambda item: (item["makeModel"], item["licensePlate"])),
        "records": sorted(records, key=lambda item: (item["serviceDate"], item["id"])),
        "gaps": gaps,
    }


def to_sql(data: dict) -> str:
    def sql_str(value) -> str:
        if value is None:
            return "NULL"
        return "'" + str(value).replace("'", "''") + "'"

    lines = ["-- Import z Servisné intervaly.xlsx. user_id doplň pred spustením.", ""]
    lines.append("-- :user_id uuid")
    for customer in data["customers"]:
        lines.append(
            "insert into public.customers (id, user_id, name, phone, email) values ("
            f"{sql_str(customer['id'])}, :user_id, {sql_str(customer['name'])}, '', NULL"
            ") on conflict (id) do update set name = excluded.name;"
        )
    for vehicle in data["vehicles"]:
        first = vehicle["firstRegistrationDate"] or "1970-01-01"
        plate_sql = "NULL" if not vehicle["licensePlate"] else sql_str(vehicle["licensePlate"])
        lines.append(
            "insert into public.vehicles (id, user_id, customer_id, license_plate, vin, make_model, year, first_registration_date, engine_displacement, fuel) values ("
            f"{sql_str(vehicle['id'])}, :user_id, {sql_str(vehicle['customerId'])}, {plate_sql}, "
            f"{sql_str(vehicle['vin'])}, {sql_str(vehicle['makeModel'])}, {int(vehicle['year'])}, {sql_str(first)}, "
            f"{float(vehicle['engineDisplacement'])}, {sql_str(vehicle['fuel'])}"
            ") on conflict (id) do update set license_plate = excluded.license_plate, vin = excluded.vin, make_model = excluded.make_model;"
        )
    for record in data["records"]:
        lines.append(
            "insert into public.records (id, user_id, vehicle_id, service_date, mileage, labor_cost, material_earnings, billed_amount, mechanic_notes) values ("
            f"{sql_str(record['id'])}, :user_id, {sql_str(record['vehicleId'])}, {sql_str(record['serviceDate'])}, "
            f"{int(record['mileage'])}, {float(record['laborCost'])}, "
            f"{('NULL' if record.get('materialEarnings') is None else float(record['materialEarnings']))}, NULL, "
            f"{sql_str(record.get('mechanicNotes') or '')}"
            ") on conflict (id) do update set mileage = excluded.mileage, labor_cost = excluded.labor_cost, material_earnings = excluded.material_earnings, mechanic_notes = excluded.mechanic_notes;"
        )
        for item in record["items"]:
            lines.append(
                "insert into public.record_items (id, user_id, record_id, category, action_type, part_name, part_brand, material_type, quantity, purchase_price, sell_price, sort_index) values ("
                f"{sql_str(item['id'])}, :user_id, {sql_str(record['id'])}, {sql_str(item['category'])}, {sql_str(item['actionType'])}, "
                f"{sql_str(item['partName'])}, {sql_str(item['partBrand'])}, {sql_str(item['materialType'])}, {sql_str(item['quantity'])}, 0, 0, 0"
                ") on conflict (id) do update set part_name = excluded.part_name;"
            )
    return "\n".join(lines) + "\n"


def main():
    wb = openpyxl.load_workbook(SOURCE, data_only=True)
    built = build(collect_rows(wb))
    workshop = {
        "customers": built["customers"],
        "vehicles": built["vehicles"],
        "records": [{k: v for k, v in record.items() if k != "_source"} | {"_source": record["_source"]} for record in built["records"]],
    }
    # keep _source in records for traceability; strip if we want clean types
    clean_records = []
    for record in built["records"]:
        item = {k: v for k, v in record.items() if k != "_source"}
        clean_records.append(item)
    workshop["records"] = clean_records

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "workshop.json").write_text(json.dumps(workshop, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "gaps.json").write_text(json.dumps(built["gaps"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "workshop.sql").write_text(to_sql(workshop), encoding="utf-8")

    by_reason = defaultdict(int)
    for gap in built["gaps"]:
        by_reason[gap["reason"]] += 1

    print(f"customers {len(workshop['customers'])}")
    print(f"vehicles  {len(workshop['vehicles'])}")
    print(f"records   {len(workshop['records'])}")
    print(f"items     {sum(len(record['items']) for record in workshop['records'])}")
    print("gaps", dict(by_reason))


if __name__ == "__main__":
    main()
