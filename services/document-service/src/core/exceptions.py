"""Custom exceptions for the Document Service."""


class DocumentServiceError(Exception):
    """Base exception."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class FileTooLargeError(DocumentServiceError):
    def __init__(self, file_size: int, max_size: int = 5_242_880):
        super().__init__(
            f"File size {file_size} bytes exceeds maximum of {max_size} bytes",
            status_code=413,
        )
        self.max_size_mb = max_size // (1024 * 1024)


class InvalidFileTypeError(DocumentServiceError):
    def __init__(self, filename: str):
        super().__init__(f"'{filename}' is not a valid PDF file", status_code=415)


class EmptyFileError(DocumentServiceError):
    def __init__(self):
        super().__init__("File is empty", status_code=400)


class EmptyDocumentError(DocumentServiceError):
    def __init__(self):
        super().__init__("PDF contains no extractable text", status_code=422)


class ExtractionFailedError(DocumentServiceError):
    def __init__(self, message: str = "Entity extraction failed after max retries"):
        super().__init__(message, status_code=500)


class DocumentNotFoundError(DocumentServiceError):
    def __init__(self, document_id: str):
        super().__init__(f"Document '{document_id}' not found", status_code=404)


class AnalysisNotReadyError(DocumentServiceError):
    def __init__(self, document_id: str, current_status: str):
        super().__init__(
            f"Analysis for document '{document_id}' is not ready (status: {current_status})",
            status_code=202,
        )
        self.current_status = current_status


class JWTExpiredError(DocumentServiceError):
    def __init__(self):
        super().__init__("Token has expired", status_code=401)


class JWTSignatureError(DocumentServiceError):
    def __init__(self):
        super().__init__("Token signature is invalid", status_code=401)


class JWTInvalidAlgorithmError(DocumentServiceError):
    def __init__(self):
        super().__init__("Token uses an unsupported algorithm", status_code=400)


class LLMEmptyCompletionError(DocumentServiceError):
    def __init__(self, provider: str = "unknown"):
        super().__init__(f"LLM provider '{provider}' returned empty completion", status_code=500)


class PDFParseError(DocumentServiceError):
    def __init__(self, filename: str = ""):
        super().__init__(
            f"Failed to extract text from PDF '{filename}'" if filename else "PDF text extraction failed",
            status_code=422,
        )
