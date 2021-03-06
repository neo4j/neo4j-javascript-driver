import subprocess
import os


def run(args):
    subprocess.run(
        args, universal_newlines=True, stderr=subprocess.STDOUT, check=True)


def test_driver():
    run(["gulp", "run-stress-tests-without-jasmine"])


def test_driver_lite():
    return


if __name__ == "__main__":
    os.environ['STRESS_TEST_MODE'] = 'fastest'
    os.environ['RUNNING_TIME_IN_SECONDS'] = \
        os.environ.get('TEST_NEO4J_STRESS_DURATION', 0)
    if os.environ.get("TEST_DRIVER_LITE", False):
        test_driver_lite()
    else:
        test_driver()
