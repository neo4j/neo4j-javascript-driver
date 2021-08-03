"""
Executed in Javascript driver container.
Responsible for building driver and test backend.
"""
import os
from common import run, run_in, run_in_driver_repo, is_lite, DRIVER_REPO


def copy_files_to_workdir():
    run(["mkdir", DRIVER_REPO])
    run(["cp", "-fr", ".", DRIVER_REPO])
    run(["chown", "-Rh", "driver:driver", DRIVER_REPO])


def init_monorepo():
    run_in_driver_repo(["rm", "-fr", "node_modules"])
    run_in_driver_repo(["npm", "ci"])


def clean_and_build():
    run_in_driver_repo(["npm", "run", "clean"])
    run_in_driver_repo(["npm", "run", "build"])


def build_testkit_backend():
    run_in_testkit_backend = run_in(
        cwd=DRIVER_REPO + "packages/testkit-backend/")
    run_in_testkit_backend(["rm", "-fr", "node_modules"])
    neo4jdriverPath = "neo4j@../neo4j-driver" if not is_lite()\
        else "neo4j@../neo4j-driver-lite"
    run_in_testkit_backend(["npm", "install", neo4jdriverPath])
    run_in_testkit_backend(["npm", "install"])


if __name__ == "__main__":
    copy_files_to_workdir()
    init_monorepo()
    clean_and_build()
    build_testkit_backend()
