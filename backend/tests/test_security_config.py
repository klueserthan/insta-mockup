"""Tests for security configuration (TODO-C1 and TODO-C2)"""

import os
import sys
from unittest.mock import patch

import pytest


def test_production_requires_session_secret():
    """Test that production environment requires SESSION_SECRET to be set"""
    # Clear any existing config module
    if "config" in sys.modules:
        del sys.modules["config"]

    with patch.dict(os.environ, {"ENV": "production", "ROCKET_API_KEY": "test_key"}, clear=True):
        # Should raise RuntimeError when SESSION_SECRET is not set in production
        with pytest.raises(RuntimeError) as exc_info:
            import config  # noqa: F401

        assert "SESSION_SECRET environment variable must be set in production" in str(
            exc_info.value
        )


def test_development_allows_default_secret():
    """Test that development environment works without SESSION_SECRET"""
    # Clear any existing config module
    if "config" in sys.modules:
        del sys.modules["config"]

    with patch.dict(os.environ, {"ENV": "development", "ROCKET_API_KEY": "test_key"}, clear=True):
        # Should not raise error in development
        import config

        # Should use default secret
        assert config.SECRET_KEY == "dev-only-supersecretkey-change-in-production"
        assert config.ENVIRONMENT == "development"


def test_production_with_session_secret_works():
    """Test that production environment works when SESSION_SECRET is set"""
    # Clear any existing config module
    if "config" in sys.modules:
        del sys.modules["config"]

    with patch.dict(
        os.environ,
        {
            "ENV": "production",
            "SESSION_SECRET": "a-very-secure-secret-key-for-production",
            "ROCKET_API_KEY": "test_key",
        },
        clear=True,
    ):
        import config

        assert config.SECRET_KEY == "a-very-secure-secret-key-for-production"
        assert config.ENVIRONMENT == "production"


def test_development_shows_warning_without_secret(capfd):
    """Test that development shows warning when SESSION_SECRET is not set"""
    # Clear any existing config module
    if "config" in sys.modules:
        del sys.modules["config"]

    with patch.dict(os.environ, {"ENV": "development", "ROCKET_API_KEY": "test_key"}, clear=True):
        import warnings

        # Capture warnings
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")

            # Reload config to trigger warning
            import importlib

            import config

            importlib.reload(config)

            # Check that warning was issued
            assert len(w) > 0
            assert "SESSION_SECRET not set" in str(w[0].message)
            assert "This is NOT safe for production" in str(w[0].message)
