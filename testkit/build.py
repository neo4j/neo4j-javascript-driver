"""
Executed in Javascript driver container.
Responsible for building driver and test backend.
"""
from common import is_deno, is_team_city, run, run_in_driver_repo, DRIVER_REPO
import os


def copy_files_to_workdir():
    run(["cp", "-fr", "./", DRIVER_REPO])
    run(["chown", "-Rh", "driver:driver", DRIVER_REPO])


def init_monorepo():
    run_in_driver_repo(["rm", "-fr", "node_modules"], env=os.environ)
    run_in_driver_repo(["yarn", "install", "--ignore-engines"], env=os.environ)


def clean_and_build():
    run_in_driver_repo(["yarn", "run", "build::deno", "--", "--",
                       "--output=lib2/"], env=os.environ)

    if is_deno() and is_team_city():
        run_in_driver_repo(["diff", "-r", "-u",
                            "packages/neo4j-driver-deno/lib/",
                            "packages/neo4j-driver-deno/lib2/"])


if __name__ == "__main__":
    copy_files_to_workdir()
    init_monorepo()
    clean_and_build()
