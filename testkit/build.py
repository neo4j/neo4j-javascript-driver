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


if __name__ == "__main__":
    run(['rm', '-fr', 'node_modules', 'lib', 'build'])
    run(['npm', '--prefix', 'core', 'ci'])
    run(['npm', '--prefix', 'core', 'run', 'build'])
    run(["npm", "ci"])
    run(["gulp", "nodejs"])
    run(["gulp", "testkit-backend"])
