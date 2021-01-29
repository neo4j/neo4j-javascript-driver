import subprocess
import os


def run(args):
    subprocess.run(
        args, universal_newlines=True, stderr=subprocess.STDOUT, check=True)


if __name__ == "__main__":
    os.environ['STRESS_TEST_MODE'] = 'fastest'
    os.environ['RUNNING_TIME_IN_SECONDS'] = \
        os.environ.get('TEST_NEO4J_STRESS_DURATION', 0)
    run(["npm", "run", "run-stress-tests"])
