"""PDF file validation — size, magic-bytes, and emptiness checks."""

from src.core.config import settings
from src.core.exceptions import EmptyFileError, FileTooLargeError, InvalidFileTypeError

_PDF_MAGIC = b"%PDF"


def validate_pdf(content: bytes, filename: str, size: int) -> bool:
    """
    Validate that *content* is a legitimate PDF within the size limit.

    Args:
        content: raw file bytes
        filename: original filename (used in error messages)
        size: declared file size in bytes (must match len(content))

    Returns:
        True on success.

    Raises:
        EmptyFileError: file has zero bytes
        FileTooLargeError: file exceeds MAX_FILE_SIZE_BYTES (5 MB)
        InvalidFileTypeError: file does not start with the PDF magic bytes
    """
    if size == 0 or len(content) == 0:
        raise EmptyFileError()

    if size > settings.MAX_FILE_SIZE_BYTES:
        raise FileTooLargeError(size, settings.MAX_FILE_SIZE_BYTES)

    if content[:4] != _PDF_MAGIC:
        raise InvalidFileTypeError(filename)

    return True
