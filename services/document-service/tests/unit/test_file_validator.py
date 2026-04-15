"""
Unit tests: PDF file validation
Blueprint refs: BE-FV-001 → BE-FV-004
All pure Python — no DB, no AI, no network.
"""

import pytest

from src.services.file_validator import validate_pdf
from src.core.exceptions import EmptyFileError, FileTooLargeError, InvalidFileTypeError


class TestFileValidation:
    """BE-FV: File validation tests."""

    def test_be_fv_001_valid_pdf_under_5mb_accepted(self, sample_pdf_bytes):
        """Valid PDF with magic bytes and size well under 5 MB passes."""
        result = validate_pdf(sample_pdf_bytes, filename="test.pdf", size=len(sample_pdf_bytes))
        assert result is True

    def test_be_fv_002_file_over_5mb_raises_file_too_large(self, large_pdf_bytes):
        """File with size > 5 242 880 bytes raises FileTooLargeError with HTTP 413."""
        size = 5 * 1024 * 1024 + 1
        with pytest.raises(FileTooLargeError) as exc_info:
            validate_pdf(large_pdf_bytes, filename="huge.pdf", size=size)
        assert exc_info.value.status_code == 413
        assert exc_info.value.max_size_mb == 5

    def test_be_fv_002_error_message_contains_size_info(self, large_pdf_bytes):
        """Error message includes file size and max size."""
        size = 5 * 1024 * 1024 + 1
        with pytest.raises(FileTooLargeError) as exc_info:
            validate_pdf(large_pdf_bytes, filename="huge.pdf", size=size)
        assert str(size) in exc_info.value.message

    def test_be_fv_003_non_pdf_magic_bytes_raises_invalid_type(self, png_bytes):
        """File starting with PNG header raises InvalidFileTypeError (HTTP 415)
        even if the filename ends in .pdf."""
        with pytest.raises(InvalidFileTypeError) as exc_info:
            validate_pdf(png_bytes, filename="fake.pdf", size=len(png_bytes))
        assert exc_info.value.status_code == 415

    def test_be_fv_003_jpeg_bytes_rejected(self):
        """JPEG magic bytes (FF D8 FF) are also rejected."""
        jpeg_bytes = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        with pytest.raises(InvalidFileTypeError):
            validate_pdf(jpeg_bytes, filename="photo.pdf", size=len(jpeg_bytes))

    def test_be_fv_003_zip_bytes_rejected(self):
        """ZIP magic bytes (PK\\x03\\x04) are rejected."""
        zip_bytes = b"PK\x03\x04" + b"\x00" * 100
        with pytest.raises(InvalidFileTypeError):
            validate_pdf(zip_bytes, filename="archive.pdf", size=len(zip_bytes))

    def test_be_fv_004_empty_file_raises_empty_file_error(self):
        """File with 0 bytes raises EmptyFileError (HTTP 400)."""
        with pytest.raises(EmptyFileError) as exc_info:
            validate_pdf(b"", filename="empty.pdf", size=0)
        assert exc_info.value.status_code == 400

    def test_be_fv_004_empty_content_with_nonzero_size_raises(self):
        """Content bytes are empty even if size param claims otherwise."""
        with pytest.raises(EmptyFileError):
            validate_pdf(b"", filename="empty.pdf", size=100)

    def test_be_fv_005_exactly_at_5mb_limit_is_accepted(self, sample_pdf_bytes):
        """A file exactly at 5 242 880 bytes is accepted (boundary check)."""
        # Build PDF-magic content padded to exactly 5 MB
        content = b"%PDF-1.4\n" + b"x" * (5 * 1024 * 1024 - 9)
        assert len(content) == 5 * 1024 * 1024
        result = validate_pdf(content, filename="exact.pdf", size=len(content))
        assert result is True

    def test_be_fv_006_one_byte_over_limit_is_rejected(self):
        """One byte over 5 MB triggers FileTooLargeError."""
        content = b"%PDF-1.4\n" + b"x" * (5 * 1024 * 1024 - 8)
        assert len(content) == 5 * 1024 * 1024 + 1
        with pytest.raises(FileTooLargeError):
            validate_pdf(content, filename="over.pdf", size=len(content))
