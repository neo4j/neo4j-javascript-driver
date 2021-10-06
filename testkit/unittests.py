"""
Executed in Javascript driver container.
Responsible for running unit tests.
Assumes driver has been setup by build script prior to this.
"""
import os
from common import run_in_driver_repo, is_lite


if __name__ == "__main__":
    if is_lite():
        ignore = "--ignore=neo4j-driver"
    else:
        ignore = "--ignore=neo4j-driver-lite"

    run_in_driver_repo(["npm", "run", "test::unit", "--", ignore])
