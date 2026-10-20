"""Convert the supplied 1,200-row inspection workbook into browser JSON.

The converter intentionally preserves source field names, booleans, numeric values,
and missing values. It also validates the aggregate controls published in the v2
project JSON before writing the web asset.
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import date, datetime
from pathlib import Path

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = ROOT / "public/data/source/B203_Quality_Inspection_Synthetic_v2_20261016.xlsx"
PROJECT_JSON = ROOT / "public/data/source/B203_Web_Implementation_Data_v2_20261016.json"
OUTPUT_JSON = ROOT / "src/data/qualityInspectionRecords.json"
SHEET_NAME = "최초검사_1200"


def json_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def summarize(records):
    by_type = {}
    for inspection_type in ("WELD", "FITUP", "DIMENSION"):
        rows = [row for row in records if row["type"] == inspection_type]
        by_type[inspection_type] = {
            "inspections": len(rows),
            "failures": sum(row["result"] == "FAIL" for row in rows),
            "reworks": sum(row["reworkRequired"] is True for row in rows),
        }
    return {
        "firstInspections": len(records),
        "firstFailures": sum(row["result"] == "FAIL" for row in records),
        "reworks": sum(row["reworkRequired"] is True for row in records),
        "types": by_type,
    }


def expected_summary(period):
    return {
        "firstInspections": period["firstInspections"],
        "firstFailures": period["firstFailures"],
        "reworks": period["reworks"],
        "types": {
            key: {
                "inspections": value["inspections"],
                "failures": value["failures"],
                "reworks": value["reworks"],
            }
            for key, value in period["inspectionTypeBreakdown"].items()
        },
    }


def main():
    workbook = openpyxl.load_workbook(WORKBOOK, data_only=True, read_only=True)
    worksheet = workbook[SHEET_NAME]
    rows = worksheet.iter_rows(values_only=True)
    headers = list(next(rows))
    records = [
        {header: json_value(value) for header, value in zip(headers, row)}
        for row in rows
        if any(value is not None for value in row)
    ]

    project = json.loads(PROJECT_JSON.read_text(encoding="utf-8"))
    expected_12 = expected_summary(project["quality"]["period12"])
    actual_12 = summarize(records)
    if actual_12 != expected_12:
        raise ValueError(f"12-month quality totals disagree: {actual_12} != {expected_12}")

    recent_months = {item["month"] for item in project["quality"]["months"][-6:]}
    recent_records = [record for record in records if record["month"] in recent_months]
    expected_6 = expected_summary(project["quality"]["period6"])
    actual_6 = summarize(recent_records)
    if actual_6 != expected_6:
        raise ValueError(f"6-month quality totals disagree: {actual_6} != {expected_6}")

    ids = [record["inspectionId"] for record in records]
    duplicate_ids = [item for item, count in Counter(ids).items() if count > 1]
    if duplicate_ids:
        raise ValueError(f"Duplicate inspection IDs: {duplicate_ids[:5]}")
    if any(record["blockId"] is not None for record in records):
        raise ValueError("Source workbook unexpectedly contains mapped block IDs")

    OUTPUT_JSON.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "output": str(OUTPUT_JSON),
        "headers": headers,
        "recordCount": len(records),
        "period12": actual_12,
        "period6": actual_6,
        "unmappedBlockIds": sum(record["blockId"] is None for record in records),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
