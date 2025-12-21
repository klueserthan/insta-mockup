from pathlib import Path
from typing import Set

from fastapi import UploadFile


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
