"""Compatibility entry point for refreshing the full Generations I–VIII dataset."""
import pathlib
import runpy

runpy.run_path(str(pathlib.Path(__file__).with_name('expand-data.py')), run_name='__main__')
