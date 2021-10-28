"""
Define common commands available for all the scripts
"""
import subprocess
import os


DRIVER_REPO = "/home/driver/repo/"


def run(args, env=None, cwd=None):
    subprocess.run(
        args, universal_newlines=True, stderr=subprocess.STDOUT,
        check=True, env=env, cwd=cwd)


def run_in(cwd):
    def _runIn(args, env=None):
        return run(args, env, cwd)
    return _runIn


def run_in_driver_repo(args, env=None):
    return run(args, env)


def is_lite():
    return os.environ.get("TEST_DRIVER_LITE", "False").upper() in ["TRUE", "1"]
