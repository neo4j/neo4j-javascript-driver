import os
from common import (
    is_browser,
    is_lite,
    run_in_driver_repo,
)


if __name__ == "__main__":
    os.environ["STRESS_TEST_MODE"] = "fastest"
    os.environ["RUNNING_TIME_IN_SECONDS"] = \
        os.environ.get("TEST_NEO4J_STRESS_DURATION", 0)

    if not is_browser():
        if is_lite():
            ignore = "--ignore=neo4j-driver"
        else:
            ignore = "--ignore=neo4j-driver-lite"

        run_in_driver_repo(["npm", "run", "test::stress", "--", ignore])
