"""
Executed in Javascript driver container.
Responsible for running unit tests.
Assumes driver has been setup by build script prior to this.
"""
import subprocess
import os


def run(args):
    subprocess.run(
        args, universal_newlines=True, stderr=subprocess.STDOUT, check=True)


def test_driver():
    run(["gulp", "test-nodejs-unit"])
    run(["gulp", "run-ts-declaration-tests"])


def test_driver_lite():
    # to be implemented
    return


if __name__ == "__main__":
    run(['npm', '--prefix', 'core', 'run', 'test'])
    run(['npm', '--prefix', 'bolt-connection', 'run', 'test'])
    if os.environ.get("TEST_DRIVER_LITE", False):
        test_driver_lite()
    else:
        test_driver()
