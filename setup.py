"""
Setup configuration for TechForge AI Agent Suite
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read README for long description
this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text(encoding="utf-8")

# Read requirements
requirements = []
with open("requirements.txt") as f:
    requirements = [line.strip() for line in f if line.strip() and not line.startswith("#")]

# Development requirements
dev_requirements = [
    "pytest>=7.4.3",
    "pytest-asyncio>=0.21.1",
    "pytest-cov>=4.1.0",
    "black>=23.12.0",
    "pylint>=3.0.3",
    "mypy>=1.7.1",
    "isort>=5.13.2",
    "flake8>=6.1.0",
    "pre-commit>=3.6.0",
]

setup(
    name="techforge-ai-suite",
    version="2.0.0",
    author="TechForge AI",
    author_email="support@techforge.ai",
    description="Enterprise-Grade AI Development Team at Your Command",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/techforge/agent-suite",
    project_urls={
        "Bug Tracker": "https://github.com/techforge/agent-suite/issues",
        "Documentation": "https://docs.techforge.ai",
        "Source Code": "https://github.com/techforge/agent-suite",
    },
    packages=find_packages(exclude=["tests", "tests.*", "docs", "docs.*"]),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Application Frameworks",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "License :: Other/Proprietary License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
        "Environment :: Console",
        "Environment :: Web Environment",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        "dev": dev_requirements,
        "test": [
            "pytest>=7.4.3",
            "pytest-asyncio>=0.21.1",
            "pytest-cov>=4.1.0",
            "httpx-mock>=0.24.0",
        ],
        "monitoring": [
            "prometheus-client>=0.19.0",
            "sentry-sdk>=1.39.1",
        ],
        "ai": [
            "openai>=1.5.0",
            "anthropic>=0.7.8",
            "langchain>=0.0.350",
            "transformers>=4.36.2",
        ],
    },
    entry_points={
        "console_scripts": [
            "techforge=cli.techforge_enhanced:main",
            "techforge-cli=cli.techforge:main",
        ],
    },
    include_package_data=True,
    package_data={
        "": ["*.yaml", "*.yml", "*.json", "*.md", "*.txt"],
        "docker": ["*.conf", "*.yml", "*.yaml"],
        "configs": ["*.yaml", "*.yml", "*.json"],
    },
    zip_safe=False,
    keywords=[
        "ai",
        "agents",
        "automation",
        "development",
        "enterprise",
        "fastapi",
        "asyncio",
        "docker",
        "kubernetes",
    ],
)