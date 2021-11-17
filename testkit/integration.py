
import os
from common import (
    is_browser,
    is_lite,
    run_in_driver_repo,
)

if __name__ == "__main__":
    os.environ["TEST_NEO4J_IPV6_ENABLED"] = "False"

    if is_lite():
        ignore = "--ignore=neo4j-driver"
    else:
        ignore = "--ignore=neo4j-driver-lite"

    if is_browser():
        run_in_driver_repo(["npm", "run", "test::browser", "--", ignore])
    else:
        run_in_driver_repo(["npm", "run", "test::integration", "--", ignore])
