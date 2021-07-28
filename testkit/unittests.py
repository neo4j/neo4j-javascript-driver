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


def test_driver():
    run(["gulp", "test-nodejs-unit"], "./packages/neo4j-driver")
    run(["gulp", "run-ts-declaration-tests"], "./packages/neo4j-driver")


def test_driver_lite():
    run(["npm", "test"], "./packages/neo4j-driver-lite")
    return


if __name__ == "__main__":
    run(["npm", "run", "test"], "./packages/core")
    run(["npm", "run", "test"], "./packages/bolt-connection")
    if os.environ.get("TEST_DRIVER_LITE", False):
        test_driver_lite()
    else:
        test_driver()
