"""
Executed in Javascript driver container.
Assumes driver and backend has been built.
Responsible for starting the test backend.
"""
from common import DRIVER_REPO
import subprocess


if __name__ == "__main__":
    err = open("/artifacts/backenderr.log", "w")
    out = open("/artifacts/backendout.log", "w")
    subprocess.check_call(["npm", "start"], stdout=out, stderr=err,
                          cwd=DRIVER_REPO + "packages/testkit-backend")
