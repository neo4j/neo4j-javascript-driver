import subprocess
import os


def run(args):
    subprocess.run(
        args, universal_newlines=True, stderr=subprocess.STDOUT, check=True)


def test_driver():
    run(["gulp", "test-browser"])
    run(["gulp", "test-nodejs-integration"])


def test_driver_lite():
    run(['npm', '--prefix', 'neo4j-driver-lite', 'run', 'test:it'])
    run(['npm', '--prefix', 'neo4j-driver-lite', 'run', 'test:it:browser'])

if __name__ == "__main__":
    os.environ["TEST_NEO4J_IPV6_ENABLED"] = "False"
    if os.environ.get("TEST_DRIVER_LITE", False):
        test_driver_lite()
    else:
        test_driver()
