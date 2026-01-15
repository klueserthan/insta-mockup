from pathlib import Path
from typing import Set

import bleach
from fastapi import UploadFile

# Sanitization configuration for user-generated content (H2)
ALLOWED_TAGS: list[str] = []  # No HTML tags allowed in plain text fields
ALLOWED_ATTRIBUTES: dict[str, list[str]] = {}
ALLOWED_PROTOCOLS: list[str] = ["http", "https"]


def sanitize_text(text: str) -> str:
    """
    Sanitize plain text by removing all HTML tags and escaping special characters.
    Used for captions, comments, names, and other user-generated content to prevent XSS.
    """
    if not text:
        return ""
    return bleach.clean(text, tags=ALLOWED_TAGS, strip=True)


def sanitize_html(text: str, allowed_tags: list[str] | None = None) -> str:
    """
    Sanitize HTML content to prevent XSS while allowing specific safe tags.
    By default, allows basic formatting tags: b, i, u, em, strong, a
    """
    if not text:
        return ""

    tags = allowed_tags if allowed_tags is not None else ["b", "i", "u", "em", "strong", "a"]
    attributes = {"a": ["href", "title"]} if "a" in tags else {}

    return bleach.clean(
        text, tags=tags, attributes=attributes, protocols=ALLOWED_PROTOCOLS, strip=True
    )


class FileValidator:
    def __init__(
        self,
        max_size: int = 50 * 1024 * 1024,  # 50MB default
        allowed_extensions: Set[str] = {".jpg", ".jpeg", ".png", ".gif", ".mp4", ".mov", ".webm"},
    ):
        self.max_size = max_size
        self.allowed_extensions = allowed_extensions

    async def validate_file(self, file: UploadFile) -> dict:
        result = {"valid": True, "errors": []}

        # Check filename
        if not file.filename:
            result["valid"] = False
            result["errors"].append("No filename provided")
            return result

        # Check extension
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in self.allowed_extensions:
            result["valid"] = False
            result["errors"].append(f"File extension '{file_ext}' not allowed")

        # Check size (requires reading or seeking if supported, or checking content-length header as proxy)
        # UploadFile is a SpooledTemporaryFile.
        # Ideally we check size before saving fully, but we can check cursor end.

        # Simple size check using seek
        file.file.seek(0, 2)  # Seek to end
        size = file.file.tell()
        file.file.seek(0)  # Reset

        if size > self.max_size:
            result["valid"] = False
            result["errors"].append(f"File too large ({size} bytes). Max: {self.max_size}")

        return result
