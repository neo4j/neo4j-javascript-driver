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


def build_core():
    run_in_core = run_in(cwd="./packages/core/")
    run_in_core(["rm", "-fr", "node_modules", "lib", "types"])
    run_in_core(["npm", "ci"])
    run_in_core(["npm", "run", "build"])


def build_bolt_connection():
    run_in_bolt_connection = run_in(cwd="./packages/bolt-connection/")
    run_in_bolt_connection(["rm", "-fr", "node_modules", "lib"])
    run_in_bolt_connection(["npm", "ci"])
    run_in_bolt_connection(["npm", "run", "build"])


def build_driver():
    run_in_driver = run_in(cwd="./packages/neo4j-driver/")
    run_in_driver(["rm", "-fr", "node_modules", "lib", "build"])
    run_in_driver(["npm", "ci"])
    run_in_driver(["gulp", "nodejs"])


def build_driver_lite():
    run_in_driver_lite = run_in(cwd="./packages/neo4j-driver-lite/")
    run_in_driver_lite(["rm", "-fr", "node_modules", "lib"])
    run_in_driver_lite(["npm", "ci"])
    run_in_driver_lite(["npm", "run", "build"])


def build_testkit_backend(isLite):
    run_in_testkit_backend = run_in(cwd="./packages/testkit-backend/")
    run_in_testkit_backend(["rm", "-fr", "node_modules"])
    run_in_testkit_backend(["npm", "install"])
    neo4jdriverPath = "neo4j@../neo4j-driver"
    if isLite:
        neo4jdriverPath = "neo4j@../neo4j-driver-lite"
    run_in_testkit_backend(["npm", "install", neo4jdriverPath])


if __name__ == "__main__":
    isLite = os.environ.get("TEST_DRIVER_LITE", False)
    build_core()
    build_bolt_connection()
    if isLite:
        build_driver_lite()
    build_driver()
    build_testkit_backend(isLite)
