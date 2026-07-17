from __future__ import annotations

import csv
import json
import re
import statistics
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / ".local" / "legacy"
ANALYSIS_DIR = ROOT / ".local" / "analysis"
WORKBOOK_PROFILE = ANALYSIS_DIR / "workbooks" / "workbook-profile.json"
OUTPUT_PATH = ANALYSIS_DIR / "legacy-profile.json"


def clean(value: str | None) -> str:
    return (value or "").strip()


def normalize_text(value: str | None) -> str:
    value = clean(value).casefold()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def read_tsv(path: Path) -> tuple[list[str], list[dict[str, str]], dict]:
    rows: list[dict[str, str]] = []
    malformed_widths: Counter[int] = Counter()
    with path.open("r", encoding="cp1252", newline="") as stream:
        reader = csv.reader(stream, delimiter="\t", quotechar='"')
        raw_rows = list(reader)

    headers = [clean(value) for value in raw_rows[0]]
    trailing_empty_headers = 0
    while headers and not headers[-1]:
        trailing_empty_headers += 1
        headers.pop()
    for raw in raw_rows[1:]:
        malformed_widths[len(raw)] += 1
        padded = raw[: len(headers)] + [""] * max(0, len(headers) - len(raw))
        rows.append(dict(zip(headers, padded, strict=True)))

    structure = {
        "encoding": "Windows-1252",
        "delimiter": "tab",
        "header_count": len(headers),
        "row_width_distribution": dict(sorted(malformed_widths.items())),
        "rows_with_unexpected_width": sum(
            count for width, count in malformed_widths.items() if width != len(headers)
        ),
        "trailing_empty_export_columns": trailing_empty_headers,
    }
    return headers, rows, structure


def column_profile(headers: list[str], rows: list[dict[str, str]]) -> dict:
    result = {}
    for header in headers:
        values = [row[header] for row in rows]
        nonempty = [clean(value) for value in values if clean(value)]
        result[header] = {
            "nonempty": len(nonempty),
            "missing": len(values) - len(nonempty),
            "distinct_nonempty": len(set(nonempty)),
            "leading_or_trailing_whitespace": sum(
                1 for value in values if value and value != value.strip()
            ),
            "max_length": max((len(value) for value in nonempty), default=0),
        }
    return result


def duplicate_group_metrics(values: list[str]) -> dict:
    counts = Counter(value for value in values if value)
    groups = [count for count in counts.values() if count > 1]
    return {
        "duplicate_groups": len(groups),
        "records_in_duplicate_groups": sum(groups),
        "largest_group": max(groups, default=0),
    }


def parse_german_decimal(value: str | None) -> Decimal | None:
    text = clean(value)
    if not text:
        return None
    text = text.replace("€", "").replace(" ", "")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def numeric_summary(values: list[Decimal]) -> dict:
    if not values:
        return {"count": 0}
    floats = [float(value) for value in values]
    return {
        "count": len(values),
        "min": min(floats),
        "max": max(floats),
        "mean": round(statistics.fmean(floats), 4),
        "zero": sum(1 for value in values if value == 0),
        "negative": sum(1 for value in values if value < 0),
    }


def profile_customers() -> tuple[dict, set[str]]:
    path = SOURCE_DIR / "Kunden.txt"
    headers, rows, structure = read_tsv(path)
    customer_numbers = [clean(row.get("Kundennummer")) for row in rows]
    customer_number_set = {value for value in customer_numbers if value}

    plz_values = [clean(row.get("Plz")) for row in rows]
    phone_fields = ["Telefon", "Telefon2", "Funktelefon", "Telefax"]

    email_values = [clean(row.get("Email")).casefold() for row in rows]
    exact_identity_keys = [
        "|".join(
            [
                normalize_text(row.get("Vorname")),
                normalize_text(row.get("Name")),
                normalize_text(row.get("Name2")),
                normalize_text(row.get("Strasse")),
                clean(row.get("Plz")),
                normalize_text(row.get("Ort")),
            ]
        ).strip("|")
        for row in rows
    ]
    name_plz_keys = [
        "|".join(
            [
                normalize_text(row.get("Vorname")),
                normalize_text(row.get("Name")),
                clean(row.get("Plz")),
            ]
        ).strip("|")
        for row in rows
    ]

    countries = Counter(clean(row.get("Land")) or "(blank)" for row in rows)
    cities = Counter(normalize_text(row.get("Ort")) or "(blank)" for row in rows)

    profile = {
        "file": path.name,
        "structure": structure,
        "rows": len(rows),
        "headers": headers,
        "columns": column_profile(headers, rows),
        "customer_number": {
            "missing": sum(1 for value in customer_numbers if not value),
            "distinct_nonempty": len(customer_number_set),
            **duplicate_group_metrics(customer_numbers),
            "numeric_only": sum(1 for value in customer_numbers if value.isdigit()),
            "non_numeric": sum(
                1 for value in customer_numbers if value and not value.isdigit()
            ),
        },
        "address_quality": {
            "missing_street": sum(1 for row in rows if not clean(row.get("Strasse"))),
            "missing_postal_code": sum(1 for value in plz_values if not value),
            "postal_code_exactly_5_digits": sum(
                1 for value in plz_values if re.fullmatch(r"\d{5}", value)
            ),
            "postal_code_invalid_nonempty": sum(
                1
                for value in plz_values
                if value and not re.fullmatch(r"\d{5}", value)
            ),
            "missing_city": sum(1 for row in rows if not clean(row.get("Ort"))),
            "distinct_normalized_cities": len(cities),
            "top_normalized_city_counts": cities.most_common(15),
            "country_counts": countries.most_common(),
        },
        "contact_quality": {
            "customers_with_any_phone_raw": sum(
                1
                for row in rows
                if any(clean(row.get(field)) for field in phone_fields)
            ),
            "phone_field_nonempty": {
                field: sum(1 for row in rows if clean(row.get(field)))
                for field in phone_fields
            },
            "phone_migration_rule": "preserve_raw_without_normalization_or_deduplication",
            "email_nonempty": sum(1 for value in email_values if value),
            "email_basic_valid": sum(
                1
                for value in email_values
                if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value)
            ),
            "email_duplicates": duplicate_group_metrics(email_values),
        },
        "duplicate_candidates": {
            "same_normalized_name_and_address": duplicate_group_metrics(
                exact_identity_keys
            ),
            "same_normalized_name_and_postal_code": duplicate_group_metrics(
                name_plz_keys
            ),
        },
        "sensitive_legacy_fields": {
            field: sum(1 for row in rows if clean(row.get(field)))
            for field in ["Bank", "Blz", "Konto", "Kontonummer"]
        },
    }
    return profile, customer_number_set


def profile_articles(customer_numbers: set[str]) -> dict:
    path = SOURCE_DIR / "lsArtikel.txt"
    headers, rows, structure = read_tsv(path)
    dates: list[datetime] = []
    invalid_dates = 0
    for row in rows:
        value = clean(row.get("Datum"))
        if not value:
            continue
        try:
            dates.append(datetime.strptime(value, "%d.%m.%Y"))
        except ValueError:
            invalid_dates += 1

    quantities = [
        parsed
        for row in rows
        if (parsed := parse_german_decimal(row.get("Anzahl"))) is not None
    ]
    net_prices = [
        parsed
        for row in rows
        if (parsed := parse_german_decimal(row.get("Einzelpreis"))) is not None
    ]
    gross_prices = [
        parsed
        for row in rows
        if (parsed := parse_german_decimal(row.get("Bruttoeinzelpreis"))) is not None
    ]

    row_customer_numbers = [clean(row.get("Kundennummer")) for row in rows]
    linked_rows = [
        value for value in row_customer_numbers if value and value in customer_numbers
    ]
    unmatched_rows = [
        value
        for value in row_customer_numbers
        if value and value not in customer_numbers
    ]
    rows_per_customer = Counter(value for value in linked_rows if value)

    document_numbers = [clean(row.get("Nummer")) for row in rows]
    document_prefixes = Counter(
        (re.match(r"^[^\d]+", value).group(0) if re.match(r"^[^\d]+", value) else "(numeric)")
        for value in document_numbers
        if value
    )
    article_numbers = [clean(row.get("Artikelnummer")) for row in rows]
    descriptions = Counter(
        normalize_text(row.get("Bezeichnung")) or "(blank)" for row in rows
    )
    serials = [normalize_text(row.get("Seriennummer")) for row in rows]

    return {
        "file": path.name,
        "structure": structure,
        "rows": len(rows),
        "headers": headers,
        "columns": column_profile(headers, rows),
        "dates": {
            "nonempty": len(dates) + invalid_dates,
            "parsed": len(dates),
            "invalid": invalid_dates,
            "min": min(dates).date().isoformat() if dates else None,
            "max": max(dates).date().isoformat() if dates else None,
        },
        "customer_link": {
            "rows_with_customer_number": sum(
                1 for value in row_customer_numbers if value
            ),
            "linked_rows": len(linked_rows),
            "unmatched_rows": len(unmatched_rows),
            "unmatched_distinct_customer_numbers": len(set(unmatched_rows)),
            "distinct_linked_customers": len(rows_per_customer),
            "rows_per_linked_customer": {
                "min": min(rows_per_customer.values(), default=0),
                "max": max(rows_per_customer.values(), default=0),
                "mean": (
                    round(statistics.fmean(rows_per_customer.values()), 4)
                    if rows_per_customer
                    else 0
                ),
            },
        },
        "document_number": {
            "missing": sum(1 for value in document_numbers if not value),
            "distinct_nonempty": len({value for value in document_numbers if value}),
            "prefix_counts": document_prefixes.most_common(),
            **duplicate_group_metrics(document_numbers),
        },
        "article_number": {
            "missing": sum(1 for value in article_numbers if not value),
            "distinct_nonempty": len({value for value in article_numbers if value}),
            **duplicate_group_metrics(article_numbers),
        },
        "description": {
            "distinct_normalized": len(descriptions),
            "top_normalized_counts": descriptions.most_common(30),
        },
        "serial_number": {
            "nonempty": sum(1 for value in serials if value),
            "distinct_nonempty": len({value for value in serials if value}),
            **duplicate_group_metrics(serials),
        },
        "quantity": numeric_summary(quantities),
        "net_price": numeric_summary(net_prices),
        "gross_price": numeric_summary(gross_prices),
        "categorical_counts": {
            field: Counter(clean(row.get(field)) or "(blank)" for row in rows).most_common()
            for field in ["Art", "Code"]
        },
    }


def cell_matrix(sheet: dict) -> list[list[object | None]]:
    rows = sheet["matrix"]["rows"]
    cols = sheet["matrix"]["cols"]
    matrix: list[list[object | None]] = [[None for _ in range(cols)] for _ in range(rows)]
    for cell in sheet["matrix"]["cells"]:
        value = cell["value"]
        if isinstance(value, dict) and value.get("type") == "date":
            value = value["value"]
        matrix[cell["row"] - 1][cell["col"] - 1] = value
    return matrix


def profile_workbooks() -> dict:
    raw = json.loads(WORKBOOK_PROFILE.read_text(encoding="utf8"))

    plz_sheet = raw["PLZ-Gebiet.xlsx"]["sheets"][0]
    plz_matrix = cell_matrix(plz_sheet)
    plz_rows = []
    for row in plz_matrix[2:]:
        if not any(value not in (None, "") for value in row):
            continue
        plz_rows.append(
            {
                "city": clean(str(row[0] or "")),
                "plz": clean(str(row[1] or "")),
                "dialing_code": clean(str(row[2] or "")),
                "region": clean(str(row[3] or "")),
            }
        )

    region_counts = Counter(row["region"] or "(blank)" for row in plz_rows)
    postal_codes = [row["plz"] for row in plz_rows]
    dialing_codes = [row["dialing_code"] for row in plz_rows]

    tour_sheets = raw["Tourplan2017.xlsx"]["sheets"]
    daten = next(sheet for sheet in tour_sheets if sheet["name"] == "Daten")
    tabelle2 = next(sheet for sheet in tour_sheets if sheet["name"] == "Tabelle2")
    tabelle3 = next(sheet for sheet in tour_sheets if sheet["name"] == "Tabelle3")
    daten_matrix = cell_matrix(daten)
    template_matrix = cell_matrix(tabelle2)
    historical_matrix = cell_matrix(tabelle3)

    historical_rows = [
        row
        for row in historical_matrix[1:]
        if any(value not in (None, "") for value in row)
    ]
    historical_dates = []
    for row in historical_rows:
        value = row[1]
        if isinstance(value, (int, float)):
            historical_dates.append(datetime(1899, 12, 30) + timedelta(days=value))
        elif isinstance(value, str):
            try:
                historical_dates.append(datetime.fromisoformat(value.replace("Z", "+00:00")))
                continue
            except ValueError:
                pass
            for pattern in ("%m/%d/%y", "%d.%m.%Y"):
                try:
                    historical_dates.append(datetime.strptime(value, pattern))
                    break
                except ValueError:
                    continue

    slot_labels = Counter()
    for row in template_matrix:
        for value in row:
            if isinstance(value, str) and value in {
                "Name",
                "Vorname",
                "Ort",
                "PLZ",
                "Straße",
                "Tel.privat",
                "Tel. dienstl.",
                "Hersteller",
                "Type",
                "Fehler",
                "Serien-Nr",
                "Kaufdatum",
                "Rep. Art",
                "Ergebnis",
            }:
                slot_labels[value] += 1

    return {
        "PLZ-Gebiet.xlsx": {
            "sheets": [
                {
                    "name": sheet["name"],
                    "rows": sheet["matrix"]["rows"],
                    "cols": sheet["matrix"]["cols"],
                    "nonempty_cells": sheet["matrix"]["nonEmptyCellCount"],
                }
                for sheet in raw["PLZ-Gebiet.xlsx"]["sheets"]
            ],
            "data_rows": len(plz_rows),
            "postal_code": {
                "distinct": len(set(postal_codes)),
                "duplicates": duplicate_group_metrics(postal_codes),
                "invalid_nonempty": sum(
                    1 for value in postal_codes if value and not re.fullmatch(r"\d{5}", value)
                ),
            },
            "dialing_code": {
                "distinct": len(set(dialing_codes)),
                "duplicates": duplicate_group_metrics(dialing_codes),
            },
            "region_counts": region_counts.most_common(),
            "missing_region_header": len(plz_matrix) >= 2
            and len(plz_matrix[1]) >= 4
            and not clean(str(plz_matrix[1][3] or "")),
            "top_contact_cell_present": bool(
                len(plz_matrix) >= 2
                and any(value not in (None, "") for value in plz_matrix[1])
            ),
        },
        "Tourplan2017.xlsx": {
            "sheets": [
                {
                    "name": sheet["name"],
                    "rows": sheet["matrix"]["rows"],
                    "cols": sheet["matrix"]["cols"],
                    "nonempty_cells": sheet["matrix"]["nonEmptyCellCount"],
                }
                for sheet in tour_sheets
            ],
            "planning_control_sheet": {
                "week_number_present": bool(
                    len(daten_matrix) > 1 and len(daten_matrix[1]) > 1 and daten_matrix[1][1]
                ),
                "technician_present": any(
                    isinstance(value, str) and "Techniker" in value
                    for row in daten_matrix
                    for value in row
                ),
                "weekday_rows": sum(
                    1
                    for row in daten_matrix
                    if row
                    and isinstance(row[0], str)
                    and any(
                        day in row[0]
                        for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
                    )
                ),
                "region_schedule_rows": sum(
                    1
                    for row in daten_matrix
                    if row
                    and isinstance(row[0], str)
                    and row[0]
                    in ["Schwedt", "Prenzlau/ Pasewalk", "Templin", "EW/ FRW/ Wriezen"]
                ),
            },
            "printed_tour_template": {
                "repeated_field_labels": slot_labels.most_common(),
                "contains_vehicle_and_mileage_fields": any(
                    isinstance(value, str)
                    and ("Fahrzeug" in value or "Kilometerstand" in value)
                    for row in template_matrix
                    for value in row
                ),
                "contains_call_ahead_marker": any(
                    isinstance(value, str) and "vorab anrufen" in value
                    for row in template_matrix
                    for value in row
                ),
            },
            "historical_entries": {
                "rows": len(historical_rows),
                "rows_with_document_number": sum(
                    1 for row in historical_rows if row and row[0] not in (None, "")
                ),
                "rows_with_amount": sum(
                    1 for row in historical_rows if len(row) > 6 and row[6] not in (None, "")
                ),
                "min_date": min(historical_dates).date().isoformat()
                if historical_dates
                else None,
                "max_date": max(historical_dates).date().isoformat()
                if historical_dates
                else None,
                "distinct_location_count": len(
                    {
                        normalize_text(str(row[4]))
                        for row in historical_rows
                        if len(row) > 4 and row[4] not in (None, "")
                    }
                ),
                "distinct_result_code_count": len(
                    {
                        clean(str(row[5]))
                        for row in historical_rows
                        if len(row) > 5 and row[5] not in (None, "")
                    }
                ),
            },
        },
    }


def main() -> None:
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    customer_profile, customer_numbers = profile_customers()
    result = {
        "customers": customer_profile,
        "articles": profile_articles(customer_numbers),
        "workbooks": profile_workbooks(),
    }
    OUTPUT_PATH.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf8",
    )

    compact = {
        "customers": {
            "rows": result["customers"]["rows"],
            "customer_number": result["customers"]["customer_number"],
            "address_quality": result["customers"]["address_quality"],
            "contact_quality": result["customers"]["contact_quality"],
            "duplicate_candidates": result["customers"]["duplicate_candidates"],
        },
        "articles": {
            "rows": result["articles"]["rows"],
            "dates": result["articles"]["dates"],
            "customer_link": result["articles"]["customer_link"],
            "document_number": result["articles"]["document_number"],
            "article_number": result["articles"]["article_number"],
            "serial_number": result["articles"]["serial_number"],
        },
        "workbooks": result["workbooks"],
    }
    print(json.dumps(compact, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
