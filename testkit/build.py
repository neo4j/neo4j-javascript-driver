"""
Executed in Javascript driver container.
Responsible for building driver and test backend.
"""
import os
import subprocess
import shutil


def run(args, env=None):
    subprocess.run(
        args, universal_newlines=True, stderr=subprocess.STDOUT, check=True, env=env)


def build_core():
    npm = ["npm", "--prefix", "core"]
    run(['rm', '-fr', 'core/node_modules', 'core/lib', 'core/types'])
    run([*npm, 'ci'])
    run([*npm, 'run', 'build'])


def build_bolt_connection():
    npm = ['npm', '--prefix', 'bolt-connection']
    run(['rm', '-fr', 'bolt-connection/node_modules', 'bolt-connection/lib'])
    run([*npm, 'ci'])
    run([*npm, 'run', 'build'])


def build_driver():
    run(['rm', '-fr', 'node_modules', 'lib', 'build'])
    run(["npm", "ci"])
    run(["gulp", "nodejs"])


def build_driver_lite():
    npm = ['npm', '--prefix', 'neo4j-driver-lite']
    run(['rm', '-fr', 'neo4j-driver-lite/node_modules', 'neo4j-driver-lite/lib'])
    run([*npm, "ci"])
    run([*npm, "run", "build"])


def build_testkit_backend(isLite):
    npm = ["npm", "--prefix", "testkit-backend"]
    run(['rm', '-fr', 'testkit-backend/node_modules'])
    run([*npm, "install"])
    neo4jdriverPath = "neo4j@./"
    if isLite: 
        neo4jdriverPath = "neo4j@./neo4j-driver-lite"
    run([*npm, "install", neo4jdriverPath])


if __name__ == "__main__":
    isLite = os.environ.get("TEST_DRIVER_LITE", False)
    build_core()
    build_bolt_connection()
    if isLite:
        build_driver_lite()
    build_driver()
    build_testkit_backend(isLite)
