"""
Executed in Javascript driver container.
Responsible for running unit tests.
Assumes driver has been setup by build script prior to this.
"""
import subprocess


def run(args):
    subprocess.run(
        args, universal_newlines=True, stderr=subprocess.STDOUT, check=True)


if __name__ == "__main__":
    run(['npm', '--prefix', 'core', 'run', 'test'])
    run(["gulp", "test-nodejs-unit"])
    run(["gulp", "run-ts-declaration-tests"])
