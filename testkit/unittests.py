"""
Executed in Javascript driver container.
Responsible for running unit tests.
Assumes driver has been setup by build script prior to this.
"""
import subprocess
import os


def run(args, cwd=None):
    subprocess.run(
        args, universal_newlines=True, stderr=subprocess.STDOUT, check=True, cwd=cwd)


if __name__ == "__main__":
    if os.environ.get("TEST_DRIVER_LITE", False):
        ignore = "--ignore=neo4j-driver"
    else:
        ignore = "--ignore=neo4j-driver-lite"

    run(["npm", "run", "test::unit", "--", ignore])
