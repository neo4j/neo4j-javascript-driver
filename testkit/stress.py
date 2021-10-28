import os
from posix import environ
from common import run_in_driver_repo, is_lite


if __name__ == "__main__":
    os.environ["STRESS_TEST_MODE"] = "fastest"
    os.environ["RUNNING_TIME_IN_SECONDS"] = \
        os.environ.get("TEST_NEO4J_STRESS_DURATION", 0)

    if is_lite():
        ignore = "--ignore=neo4j-driver"
    else:
        ignore = "--ignore=neo4j-driver-lite"

    run_in_driver_repo(["npm", "run", "test::stress",
                        "--", ignore], env=os.environ)
