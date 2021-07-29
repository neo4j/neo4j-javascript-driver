import subprocess
import os


def run(args, cwd=None):
    subprocess.run(
        args, universal_newlines=True, stderr=subprocess.STDOUT, check=True, cwd=cwd)


if __name__ == "__main__":
    os.environ["STRESS_TEST_MODE"] = "fastest"
    os.environ["RUNNING_TIME_IN_SECONDS"] = \
        os.environ.get("TEST_NEO4J_STRESS_DURATION", 0)

    if os.environ.get("TEST_DRIVER_LITE", False):
        ignore = "--ignore=neo4j-driver"
    else:
        ignore = "--ignore=neo4j-driver-lite"

    run(["npm", "run", "test::stress", "--", ignore])
