"""
Executed in Javascript driver container.
Assumes driver and backend has been built.
Responsible for starting the test backend.
"""
import os
import subprocess

if __name__ == "__main__":
    goPath = "/home/build"
    backendPath = os.path.join(goPath, "bin", "testkit-backend")
    err = open("/artifacts/backenderr.log", "w")
    out = open("/artifacts/backendout.log", "w")
    subprocess.check_call(
        ["node", "build/testkit-backend/main.js"], stdout=out, stderr=err)
