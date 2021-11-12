
import os
from common import run_in_driver_repo, is_lite, is_browser

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
