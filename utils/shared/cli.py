"""
Command-line handling shared by the scripts in this repository.

Most of these scripts take no options: they do one job against Anki or the data
directories. They still need to answer `--help`, and to refuse arguments they do
not understand - a script that silently does its work when called with an
unexpected flag is a foot-gun, since the work usually writes to the collection.
"""

import argparse


def parse_no_arguments(description: str | None) -> None:
    """
    Handle `--help` for a script that takes no arguments, and reject any others.

    Call this first in `main()`, passing the script's `__doc__` as the
    description: `-h`/`--help` then prints that docstring, and anything else
    exits with a usage error instead of running the script.

    Args:
        description: Help text for the script, normally its module docstring

    Raises:
        SystemExit: On `--help`, or when any argument is given
    """
    parser = argparse.ArgumentParser(
        description=description,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.parse_args()
