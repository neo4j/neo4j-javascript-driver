"""
Executed in Javascript driver container.
Assumes driver and backend has been built.
Responsible for starting the test backend.
"""
from common import (
    open_proccess_in_driver_repo,
    is_browser,
)
import os
import time

if __name__ == "__main__":
    print("starting backend")
    if is_browser():
        print("Testkit should test browser")
        os.environ["TEST_ENVIRONMENT"] = "REMOTE"

    print("npm run start-testkit-backend")
    with open_proccess_in_driver_repo([
        "npm", "run", "start-testkit-backend"
    ], env=os.environ) as backend:
        if (is_browser()):
            time.sleep(5)
            print("openning firefox")
            with open_proccess_in_driver_repo([
                "firefox", "-headless", "http://localhost:8000"
            ]) as firefox:
                firefox.wait()
        backend.wait()
