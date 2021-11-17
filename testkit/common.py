"""
Define common commands available for all the scripts
"""
import subprocess
import os
import sys


DRIVER_REPO = "/home/driver/repo/"


def is_enabled(value):
    return value.lower() in (
        "y", "yes", "t", "true", "1", "on"
    )


def run(args, env=None, cwd=None, check=True):
    subprocess.run(
        args, universal_newlines=True, stderr=sys.stderr, stdout=sys.stdout,
        check=check, env=env, cwd=cwd)


def run_in(cwd):
    def _runIn(args, env=None):
        return run(args, env, cwd)
    return _runIn


def run_in_driver_repo(args, env=None, check=True):
    return run(args, env, DRIVER_REPO, check=check)


def open_proccess_in_driver_repo(args, env=None):
    return subprocess.Popen(args, cwd=DRIVER_REPO, env=env, stderr=sys.stderr,
                            stdout=sys.stdout)


def is_lite():
    return is_enabled(os.environ.get("TEST_DRIVER_LITE", "false"))


def is_browser():
    return is_enabled(os.environ.get("TEST_DRIVER_BROWSER", "false"))
