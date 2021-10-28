"""
Executed in Javascript driver container.
Assumes driver and backend has been built.
Responsible for starting the test backend.
"""
import os
import subprocess
if __name__ == "__main__":
    err = open("/artifacts/backenderr.log", "w")
    out = open("/artifacts/backendout.log", "w")
    subprocess.check_call(["npm", "run", "start-testkit-backend"],
                          env=os.environ, stdout=out, stderr=err)
