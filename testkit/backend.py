"""
Executed in Javascript driver container.
Assumes driver and backend has been built.
Responsible for starting the test backend.
"""
from common import run_in_driver_repo
import os

if __name__ == "__main__":
    run_in_driver_repo(["npm", "run", "start-testkit-backend"], env=os.environ)
