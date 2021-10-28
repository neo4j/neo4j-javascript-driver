"""
Executed in Javascript driver container.
Responsible for building driver and test backend.
"""
from common import run, run_in_driver_repo
import os
import pathlib



def define_npm_home():
    os.environ["HOME"] = str(pathlib.Path().resolve())


def init_monorepo():
    run_in_driver_repo(["rm", "-fr", "node_modules"], env=os.environ)
    run_in_driver_repo(["npm", "ci"], env=os.environ)


def clean_and_build():
    run_in_driver_repo(["npm", "run", "clean"], env=os.environ)
    run_in_driver_repo(["npm", "run", "build", "--",
                        "--ignore-scripts"], env=os.environ)
    run_in_driver_repo(["npm", "run", "lerna", "--",
                        "run", "prepare"], env=os.environ)


if __name__ == "__main__":
    define_npm_home()
    init_monorepo()
    clean_and_build()
