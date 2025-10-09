
import os
from common import (
    is_browser,
    is_deno,
    is_lite,
    run_in_driver_repo,
)

if __name__ == "__main__":
    os.environ["TEST_NEO4J_IPV6_ENABLED"] = "False"
    os.environ["TEST_CONTAINERS_DISABLED"] = "True"

    if is_lite():
        filter = "--filter=\!neo4j-driver"
    else:
        filter = "--filter=\!neo4j-driver-deno --filter=\!neo4j-driver-lite"

    if is_deno():
        pass
    elif is_browser():
        run_in_driver_repo(["pnpm", filter, "run", "test::browser"], env=os.environ)
    else:
        run_in_driver_repo(
            ["pnpm", filter, "run", "test::integration"], env=os.environ)
