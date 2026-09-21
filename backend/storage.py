import os
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from backend.config import get_settings

settings = get_settings()

S3_BUCKET_NAME = settings.s3_bucket_name


def get_s3_client():
    """
    Create an S3 client.

    Local development:
        Uses the configured AWS SSO profile.

    Production:
        Uses AWS credentials supplied through environment variables.
    """
    aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    aws_session_token = os.getenv("AWS_SESSION_TOKEN")

    if aws_access_key_id and aws_secret_access_key:
        return boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            aws_session_token=aws_session_token,
        )

    session = boto3.Session(
        profile_name="NorthstarAdmin-737892386191",
        region_name=settings.aws_region,
    )

    return session.client("s3")


def upload_file(
    file_path: Path,
    storage_key: str,
    content_type: str | None = None,
) -> None:
    """
    Upload a local file to the Northstar S3 bucket.
    """

    file_path = Path(file_path)

    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    extra_args = {}

    if content_type:
        extra_args["ContentType"] = content_type

    get_s3_client().upload_file(
        str(file_path),
        S3_BUCKET_NAME,
        storage_key,
        ExtraArgs=extra_args or None,
    )


def download_file(
    storage_key: str,
    file_path: Path,
) -> None:
    """
    Download a file from the Northstar S3 bucket.
    """

    file_path = Path(file_path)
    file_path.parent.mkdir(parents=True, exist_ok=True)

    get_s3_client().download_file(
        S3_BUCKET_NAME,
        storage_key,
        str(file_path),
    )


def delete_file(storage_key: str) -> None:
    """
    Delete an object from the Northstar S3 bucket.
    """

    get_s3_client().delete_object(
        Bucket=S3_BUCKET_NAME,
        Key=storage_key,
    )


def file_exists(storage_key: str) -> bool:
    """
    Check whether an object exists in the Northstar S3 bucket.
    """

    try:
        get_s3_client().head_object(
            Bucket=S3_BUCKET_NAME,
            Key=storage_key,
        )
        return True
    except ClientError:
        return False