import json
import re
import pandas as pd
from .ollama_client import generate
from .sandbox import safe_exec

CODE_SYSTEM = """You are a Python/pandas code generator for KKM health data analysis.
Given a user question and a DataFrame schema, write pandas code to answer it.
Rules:
- The DataFrame is available as `df` (all columns are strings unless stated otherwise)
- Store your final answer in a variable called `result`
- result must be a scalar, list, dict, or small DataFrame (max 20 rows)
- Use only pd, np, and df — no imports, no file I/O
- Return only the code block, no explanation"""

ANSWER_SYSTEM = """You are SmartDQC, a bilingual (Bahasa Malaysia and English) data analyst for KKM.
Given a user question and the computed result, write a clear answer in both languages.
Always respond with valid JSON only."""


def _schema_context(df: pd.DataFrame) -> str:
    lines = [f"DataFrame shape: {df.shape[0]} rows × {df.shape[1]} columns"]
    lines.append("Columns and sample values:")
    for col in df.columns[:30]:
        sample = df[col].dropna().head(3).tolist()
        lines.append(f"  {col}: {sample}")
    return "\n".join(lines)


def _extract_code(raw: str) -> str:
    match = re.search(r"```(?:python)?\n(.*?)```", raw, re.DOTALL)
    if match:
        return match.group(1).strip()
    return raw.strip()


def _result_to_json_safe(result) -> object:
    if isinstance(result, pd.DataFrame):
        return result.head(20).to_dict(orient="records")
    if isinstance(result, pd.Series):
        return result.head(20).to_dict()
    if hasattr(result, "item"):
        return result.item()
    return result


def answer_query(query: str, df: pd.DataFrame) -> dict:
    schema = _schema_context(df)

    code_prompt = f"""User question: {query}

{schema}

Write pandas code to answer this question. Store the answer in `result`."""

    raw_code = generate(code_prompt, system=CODE_SYSTEM)
    code = _extract_code(raw_code)

    result, error = safe_exec(code, df)

    if error:
        answer_context = f"The code failed with error: {error}"
        result_safe = None
    else:
        result_safe = _result_to_json_safe(result)
        answer_context = f"Computed result: {str(result_safe)[:500]}"

    answer_prompt = f"""User question: {query}

{answer_context}

Respond with this exact JSON:
{{
  "answer": {{"bm": "answer in Bahasa Malaysia", "en": "answer in English"}}
}}"""

    raw_answer = generate(answer_prompt, system=ANSWER_SYSTEM, json_mode=True)

    try:
        raw_answer = raw_answer.strip()
        match = re.search(r"\{.*\}", raw_answer, re.DOTALL)
        answer_json = json.loads(match.group() if match else raw_answer)
    except Exception:
        answer_json = {"answer": {"bm": raw_answer[:300], "en": raw_answer[:300]}}

    return {
        "answer": answer_json.get("answer", {"bm": "", "en": ""}),
        "result": result_safe,
        "code_used": code,
    }
