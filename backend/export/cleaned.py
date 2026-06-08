import pandas as pd
import io

# Column name patterns that must be written as Excel text format (@) to preserve
# leading zeros (IC numbers, passport numbers, MyKid IDs).
_TEXT_KEYWORDS = ("mykid", "ic_no", "no_kp", "ic_num", "passport", "ic")


def _text_columns(df: "pd.DataFrame") -> list[str]:
    """Return columns that should be forced to text in Excel output."""
    return [
        c for c in df.columns
        if df[c].dtype == object
        or any(kw in c.lower() for kw in _TEXT_KEYWORDS)
    ]


def to_excel(records: list[dict], columns: list[str], base_filename: str) -> bytes:
    df = pd.DataFrame(records, columns=columns or None)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name="Cleaned_Data")
    buf.seek(0)
    return buf.read()


def to_excel_typed(df: "pd.DataFrame") -> bytes:
    """Write DataFrame to XLSX preserving leading zeros on IC/text columns.

    Any column whose dtype is object, or whose name contains an IC-like keyword,
    is written as Excel text format (@) so values like '010304050607' survive
    round-trips through Excel without losing the leading zero.
    """
    text_cols = set(_text_columns(df))
    out = df.copy()
    for col in text_cols:
        # Coerce to str; leave NaN/None cells as-is so they render empty.
        out[col] = out[col].where(out[col].isna(), out[col].astype(str))

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        out.to_excel(w, index=False, sheet_name="Cleaned_Data")
        ws = w.sheets["Cleaned_Data"]
        for col_idx, col in enumerate(out.columns, 1):
            if col in text_cols:
                for row_idx in range(2, len(out) + 2):  # row 1 is the header
                    ws.cell(row=row_idx, column=col_idx).number_format = "@"
    buf.seek(0)
    return buf.read()


def to_csv(records: list[dict], columns: list[str]) -> bytes:
    df = pd.DataFrame(records, columns=columns or None)
    buf = io.StringIO()
    df.to_csv(buf, index=False, encoding="utf-8-sig")
    buf.seek(0)
    return buf.getvalue().encode("utf-8-sig")
