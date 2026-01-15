"""
Executed in Javascript driver container.
Responsible for running unit tests.
Assumes driver has been setup by build script prior to this.
"""
from common import is_deno, run_in_driver_repo, is_lite


if __name__ == "__main__":
    if is_lite() or is_deno():
        filter = "--filter=!neo4j-driver"
    else:
        filter = "--filter=!neo4j-driver-deno --filter=!neo4j-driver-lite"


    run_in_driver_repo(["pnpm", "run", "lint"])
    run_in_driver_repo(["pnpm", filter, "run", "test::unit"])

    if is_deno():
        run_in_driver_repo(["pnpm" "run", "test::deno"])
