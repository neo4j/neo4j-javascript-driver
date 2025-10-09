import os
from common import (
    is_browser,
    is_deno,
    is_lite,
    run_in_driver_repo,
)


if __name__ == "__main__":
    os.environ["STRESS_TEST_MODE"] = "fastest"
    os.environ["TEST_CONTAINERS_DISABLED"] = "True"
    os.environ["RUNNING_TIME_IN_SECONDS"] = \
        os.environ.get("TEST_NEO4J_STRESS_DURATION", 0)

    if not is_browser():
        if is_lite():
            filter = "--filter=\\!neo4j-driver"
        else:
            filter = "--filter=\\!neo4j-driver-deno --filter=\\!neo4j-driver-lite"

        if not is_deno():
            run_in_driver_repo(["pnpm", filter, "run", "test::stress"], env=os.environ)
