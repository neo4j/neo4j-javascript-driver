"""
Executed in Javascript driver container.
Responsible for building driver and test backend.
"""
import os
import subprocess
import shutil


def run(args, env=None, cwd=None):
    subprocess.run(
        args, universal_newlines=True, stderr=subprocess.STDOUT,
        check=True, env=env, cwd=cwd)


def run_in(cwd):
    def _runIn(args, env=None):
        return run(args, env, cwd)
    return _runIn


def build_testkit_backend(isLite):
    run_in_testkit_backend = run_in(cwd="./packages/testkit-backend/")
    run_in_testkit_backend(["rm", "-fr", "node_modules"])
    neo4jdriverPath = "neo4j@../neo4j-driver"
    if isLite:
        neo4jdriverPath = "neo4j@../neo4j-driver-lite"
    run_in_testkit_backend(["npm", "install", neo4jdriverPath])
    run_in_testkit_backend(["npm", "install"])


def init_monorepo():
    run(["rm", "-fr", "node_modules"])
    run(["npm", "ci"])


def clean_and_build():
    run(["npm", "run", "clean"])
    run(["npm", "run", "build"])


if __name__ == "__main__":
    isLite = os.environ.get("TEST_DRIVER_LITE", False)
    run(["ls", "-la"], cwd="/driver")
    init_monorepo()
    clean_and_build()
    build_testkit_backend(isLite)
