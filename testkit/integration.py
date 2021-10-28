
import os
from common import run_in_driver_repo, is_lite


def should_test_browser():
    return os.environ.get("TEST_DRIVER_SKIP_BROWSER", "false").lower() not in (
        "y", "yes", "t", "true", "1", "on"
    )


if __name__ == "__main__":
    os.environ["TEST_NEO4J_IPV6_ENABLED"] = "False"

    if is_lite():
        ignore = "--ignore=neo4j-driver"
    else:
        ignore = "--ignore=neo4j-driver-lite"

    run_in_driver_repo(["npm", "run", "test::integration",
                        "--", ignore], env=os.environ)

    if should_test_browser():
        run_in_driver_repo(["npm", "run", "test::browser",
                            "--", ignore], env=os.environ)
