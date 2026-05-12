import threading
import traceback
import pandas as pd
import numpy as np


def safe_exec(code: str, df: pd.DataFrame) -> tuple:
    """
    Execute pandas code in a restricted environment.
    Returns (result, error_message). Only pandas/numpy/df are accessible.
    """
    result_holder = [None]
    error_holder = [None]

    def run():
        restricted_globals = {
            "__builtins__": {},
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
