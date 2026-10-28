import os
import uuid
import logging
from typing import Optional
from supabase import create_client, Client
from config import settings

logger = logging.getLogger("file_storage")
logger.setLevel(logging.INFO)

_storage_client: Optional[Client] = None
BUCKET_NAME = "documents"


def get_storage_client() -> Optional[Client]:
    """Initializes and caches Supabase storage client."""
    global _storage_client
    if _storage_client is None:
        url = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
        key = settings.SUPABASE_KEY or os.environ.get("SUPABASE_KEY")
        if url and key and not url.startswith("https://your-project"):
            try:
                _storage_client = create_client(url, key)
            except Exception as e:
                logger.warning("Failed to initialize Supabase client: %s", str(e))
                _storage_client = None
    return _storage_client


def upload_file(
    file_bytes: bytes,
    filename: str,
    content_type: str = "application/pdf",
    bucket: str = BUCKET_NAME
) -> str:
    """
    Uploads a file to Supabase Storage and returns its public URL.

    Args:
        file_bytes: Raw binary content of the file.
        filename: Original filename.
        content_type: MIME type of the file.
        bucket: Supabase storage bucket name.

    Returns:
        Public URL of the uploaded asset.
    """
    client = get_storage_client()
    unique_filename = f"{uuid.uuid4().hex}_{filename}"

    if client is not None:
        try:
            # Upload file bytes to Supabase storage bucket
            client.storage.from_(bucket).upload(
                path=unique_filename,
                file=file_bytes,
                file_options={"content-type": content_type}
            )
            # Retrieve public URL
            public_url_resp = client.storage.from_(bucket).get_public_url(unique_filename)
            logger.info("Successfully uploaded %s to Supabase bucket '%s'", filename, bucket)
            return public_url_resp
        except Exception as e:
            logger.error("Error uploading %s to Supabase storage: %s", filename, str(e))
            if settings.ENVIRONMENT != "production":
                logger.info("Falling back to mock storage URL for %s", filename)
                return f"https://mock-storage.supabase.co/{bucket}/{unique_filename}"
            raise e

    # Fallback for offline development / mock environments
    logger.info("Supabase storage not connected; using generated mock storage URL for %s", filename)
    return f"https://mock-storage.supabase.co/{bucket}/{unique_filename}"


def extract_storage_path(storage_url_or_path: str, bucket: str = BUCKET_NAME) -> str:
    """
    Extracts the relative bucket path/filename from a full Supabase storage URL or path.
    """
    if not storage_url_or_path:
        return ""
    clean = storage_url_or_path.strip().split("?")[0]
    bucket_marker = f"/{bucket}/"
    if bucket_marker in clean:
        return clean.split(bucket_marker)[-1]
    return clean.rstrip("/").split("/")[-1]


def delete_storage_files(
    paths_or_urls: list[str],
    bucket: str = BUCKET_NAME
) -> bool:
    """
    Deletes files from the Supabase Storage bucket.
    Ensures deletions succeed, otherwise raises a descriptive error to abort cascading deletes.
    """
    if not paths_or_urls:
        return True

    paths = [extract_storage_path(p, bucket) for p in paths_or_urls if p]
    paths = [p for p in paths if p]

    if not paths:
        return True

    client = get_storage_client()
    if client is not None:
        try:
            logger.info("Deleting %d file(s) from Supabase storage bucket '%s': %s", len(paths), bucket, paths)
            response = client.storage.from_(bucket).remove(paths)
            logger.info("Supabase storage deletion response: %s", response)
            return True
        except Exception as e:
            logger.error("Error deleting files from Supabase storage: %s", str(e), exc_info=True)
            raise RuntimeError(f"Failed to delete files from Supabase storage bucket: {str(e)}") from e

    logger.info("Supabase storage not connected; simulated deletion of %d file(s): %s", len(paths), paths)
    return True

