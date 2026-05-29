# Toml

from pathlib import Path

pyproject = """[project]
name = "world-cup-data-tools"
version = "0.1.0"
description = "Utilities to convert FIFA World Cup CSV datasets into sweepstake-ready JSON files."
readme = "README.md"
requires-python = ">=3.12,<3.13"
dependencies = [
    "pandas>=2.2.0",
]

[project.scripts]
convert-world-cup-csv = "convert_world_cup_csv_to_json:main"

[tool.uv]
package = false
"""

path = Path("/mnt/data/pyproject.toml")
path.write_text(pyproject, encoding="utf-8")
print(path)


# Pyenv and uv

```bash
# 1. Install Python 3.12.13 with pyenv
pyenv install 3.12.13

# 2. Set Python 3.12.13 locally in your project folder
cd world-cup-sweepstake
pyenv local 3.12.13

# 3. Check Python version
python --version
# Expected: Python 3.12.13

# 4. Install uv if needed
curl -LsSf https://astral.sh/uv/install.sh | sh

# 5. Create the virtual environment using the pyenv-selected Python
uv venv --python 3.12.13

# 6. Activate the environment
source .venv/bin/activate

# 7. Install dependencies from pyproject.toml
uv sync
```

# Notebooks

```bash
# Add dependencies
uv add jupyterlab ipywidgets ipykernel

# Activate venv
source .venv/bin/activate

# Create Jupyter kernel
python -m ipykernel install --user \
  --name world-cup-data-tools \
  --display-name "Python 3.12.13 - World Cup Data Tools"

# Launch JupyterLab
uv run jupyter lab
```