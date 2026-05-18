"""Regression: safe_exec ran LLM-generated code with __builtins__ = {}, so any
`import` line (which LLMs emit despite the "no imports" prompt) raised
"ImportError: __import__ not found", and common builtins (len, round, ...)
raised NameError. The NLQ endpoint returned that as a 200 answer, so the chat
UI showed an import error while Docker logs showed 200 OK. The sandbox must
allow safe data libraries + curated builtins while still blocking os/subprocess.
"""
import pandas as pd

from backend.ai.sandbox import safe_exec


def _df() -> pd.DataFrame:
    return pd.DataFrame({"Berat_kg": [6.7, 7.5, 8.1]})


def test_generated_code_with_import_line_succeeds():
    result, error = safe_exec(
        "import pandas as pd\nimport numpy as np\nresult = df['Berat_kg'].mean()",
        _df(),
    )
    assert error is None, error
    assert round(result, 2) == 7.43


def test_common_builtins_available():
    result, error = safe_exec("result = len(df)", _df())
    assert error is None, error
    assert result == 3


def test_pure_pandas_still_works():
    result, error = safe_exec("result = df['Berat_kg'].sum()", _df())
    assert error is None, error
    assert round(result, 1) == 22.3


def test_dangerous_import_is_blocked():
    result, error = safe_exec("import os\nresult = os.getcwd()", _df())
    assert result is None
    assert error is not None and "not allowed" in error, error
