"""
Executed in Javascript driver container.
Assumes driver and backend has been built.
Responsible for starting the test backend.
"""
from common import DRIVER_REPO, run


if __name__ == "__main__":
    run(["npm", "start"], cwd=DRIVER_REPO + "packages/testkit-backend")
