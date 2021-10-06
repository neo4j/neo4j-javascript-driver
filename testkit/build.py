"""
Executed in Javascript driver container.
Responsible for building driver and test backend.
"""
from common import run, run_in_driver_repo, DRIVER_REPO
import os


def copy_files_to_workdir():
    run(["mkdir", DRIVER_REPO])
    run(["cp", "-fr", ".", DRIVER_REPO])
    run(["chown", "-Rh", "driver:driver", DRIVER_REPO])


def init_monorepo():
    run_in_driver_repo(["rm", "-fr", "node_modules"], env=os.environ)
    run_in_driver_repo(["npm", "ci"], env=os.environ)


def clean_and_build():
    run_in_driver_repo(["npm", "run", "clean"], env=os.environ)
    run_in_driver_repo(["npm", "run", "build"], env=os.environ)


if __name__ == "__main__":
    copy_files_to_workdir()
    init_monorepo()
    clean_and_build()
