import builtins as _builtins
import threading
import traceback
import pandas as pd
import numpy as np

# Modules an analysis snippet may legitimately import. Anything else (os, sys,
# subprocess, importlib, socket, builtins, ...) is refused so generated code
# cannot reach the filesystem/process. LLMs routinely emit `import pandas as pd`
# despite the prompt; refusing __import__ entirely turned every such snippet
# into "ImportError: __import__ not found".
_ALLOWED_MODULES = {
    "pandas", "numpy", "math", "datetime", "re", "statistics",
    # Pure-stdlib, no filesystem/process/network — the LLM routinely emits
    # these for analysis; refusing them turned valid snippets into ImportError.
    "json", "collections", "itertools", "functools", "decimal",
}

# Curated builtins: common, side-effect-free helpers. Deliberately excludes
# open/eval/exec/compile/getattr/setattr/globals/locals/vars/input/__import__
# (sandbox-escape vectors).
_SAFE_BUILTIN_NAMES = (
    "abs all any bool dict divmod enumerate filter float format frozenset int "
    "isinstance issubclass len list map max min print range reversed round set "
    "slice sorted str sum tuple zip True False None"
).split()


def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    if name.split(".")[0] in _ALLOWED_MODULES:
        return _builtins.__import__(name, globals, locals, fromlist, level)
    raise ImportError(f"import of '{name}' is not allowed in the sandbox")


def _build_safe_builtins() -> dict:
    safe = {n: getattr(_builtins, n) for n in _SAFE_BUILTIN_NAMES if hasattr(_builtins, n)}
    safe["__import__"] = _safe_import
    return safe


def safe_exec(code: str, df: pd.DataFrame) -> tuple:
    """
    Execute pandas code in a restricted environment.
    Returns (result, error_message). Only pandas/numpy/df, a curated set of
    builtins, and a whitelisted set of importable modules are accessible.
    """
    result_holder = [None]
    error_holder = [None]

    def run():
        restricted_globals = {
            "__builtins__": _build_safe_builtins(),
            "pd": pd,
            "np": np,
            "df": df.copy(),
        }
        local_vars = {}
        try:
            exec(code, restricted_globals, local_vars)
            result_holder[0] = local_vars.get("result", None)
        except Exception:
            error_holder[0] = traceback.format_exc(limit=3)

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    thread.join(timeout=10)

    if thread.is_alive():
        return None, "Execution timed out after 10 seconds."

    return result_holder[0], error_holder[0]
