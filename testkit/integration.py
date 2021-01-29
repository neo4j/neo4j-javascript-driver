import subprocess
import os


def run(args):
    subprocess.run(
        args, universal_newlines=True, stderr=subprocess.STDOUT, check=True)


if __name__ == "__main__":
    os.environ["TEST_NEO4J_IPV6_ENABLED"] = "False"
    run(["gulp", "test-browser"])
    run(["gulp", "test-nodejs-integration"])
