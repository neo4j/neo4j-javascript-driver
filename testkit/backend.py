"""
Executed in Javascript driver container.
Assumes driver and backend has been built.
Responsible for starting the test backend.
"""
from common import (
    open_proccess_in_driver_repo,
    is_browser,
    is_deno,
    run_in_driver_repo
)
import os
import time


if __name__ == "__main__":
    print("starting backend")
    backend_script = "start-testkit-backend"
    if is_deno():
        backend_script = "start-testkit-backend::deno"

    if is_browser():
        print("Testkit should test browser")
        os.environ["TEST_ENVIRONMENT"] = "REMOTE"

    session_type = os.environ.get("TEST_SESSION_TYPE", None)
    if session_type is not None:
        os.environ["SESSION_TYPE"] = session_type

    print("npm run start-testkit-backend")
    with open_proccess_in_driver_repo([
        "npm", "run", backend_script
    ], env=os.environ) as backend:
        if (is_browser()):
            time.sleep(5)
            print("openning firefox")
            with open_proccess_in_driver_repo([
                "firefox", "-profile ./profile -headless ", "http://localhost:8000" # type: ignore
            ]) as firefox:
                firefox.wait()
        backend.wait()
