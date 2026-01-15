#!/usr/bin/env python3
"""
CI check: prevent reintroduction of hardcoded test user credentials.
Scans Python and TypeScript files for forbidden patterns.
"""

import re
import sys
from pathlib import Path


def check_forbidden_credentials():
    """Scan codebase for forbidden test credentials (excluding test and admin files)."""
    forbidden_patterns = [
        (r"test@research\.edu", "hardcoded dev email"),
        (r"demo@research\.edu", "hardcoded demo email"),
        (r"dev@research\.edu", "hardcoded dev email"),
        (r"ensure_dev_user", "dev user seeding function"),
        (r"DEV_USER\s*=", "dev user config constant"),
    ]

    workspace_root = Path(__file__).parent.parent

    scan_paths = [
        workspace_root / "backend" / "routes",
        workspace_root / "backend" / "main.py",
        workspace_root / "backend" / "auth.py",
        workspace_root / "backend" / "config.py",
        workspace_root / "frontend" / "src",
    ]

    violations = []

    for scan_path in scan_paths:
        if not scan_path.exists():
            continue

        if scan_path.is_file():
            files_to_check = [scan_path]
        else:
            files_to_check = list(scan_path.rglob("*"))

        for file_path in files_to_check:
            if not file_path.is_file():
                continue

            if file_path.suffix not in (".py", ".tsx", ".ts", ".jsx", ".js"):
                continue

            # Skip test files, migration scripts, and CI checkers
            if any(x in file_path.parts for x in ["test", "migrate", "check_no_dev"]):
                continue

            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            for pattern, description in forbidden_patterns:
                matches = re.finditer(pattern, content, re.IGNORECASE)
                for match in matches:
                    line_num = content[: match.start()].count("\n") + 1
                    violations.append(
                        f"{file_path.relative_to(workspace_root)}:{line_num}: "
                        f"Found forbidden pattern: {description} ({match.group()})"
                    )

    if violations:
        print("SECURITY CHECK FAILED: Forbidden test credentials detected")
        print("=" * 70)
        for violation in violations:
            print(f"  {violation}")
        print("=" * 70)
        print("\nDev user credentials must not be present in code.")
        print("See .specify/memory/constitution.md for security policy.")
        return False
    else:
        print("✓ SECURITY CHECK PASSED: No forbidden credentials found")
        return True


if __name__ == "__main__":
    success = check_forbidden_credentials()
    sys.exit(0 if success else 1)
