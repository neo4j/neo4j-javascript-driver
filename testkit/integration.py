import subprocess
import os


def run(args, cwd):
    subprocess.run(
        args, universal_newlines=True, 
        stderr=subprocess.STDOUT, check=True, cwd=cwd)


def test_driver():
    if (os.environ.get("TEST_DRIVER_SKIP_BROWSER", "false").lower()
            in ("y", "yes", "t", "true", "1", "on")):
        run(["gulp", "test-browser"], "./packages/neo4j-driver")
    run(["gulp", "test-nodejs-integration"], "./packages/neo4j-driver")


def test_driver_lite():
    run(["npm", "run", "test:it"], "./packages/neo4j-driver-lite")
    run(["npm", "run", "test:it:browser"], "./packages/neo4j-driver-lite")


if __name__ == "__main__":
    os.environ["TEST_NEO4J_IPV6_ENABLED"] = "False"

    if os.environ.get("TEST_DRIVER_LITE", False):
        ignore = "--ignore=neo4j-driver"
    else:
        ignore = "--ignore=neo4j-driver-lite"

    run(["npm", "run", "test::integration", "--", ignore])
