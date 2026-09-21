import os

from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import (
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
)

load_dotenv()

COLLECTION_NAME = "financial_policies"

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

if not QDRANT_URL:
    raise ValueError("QDRANT_URL is not set in the environment.")

if not QDRANT_API_KEY:
    raise ValueError("QDRANT_API_KEY is not set in the environment.")

qdrant_client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
)

# Create an index for the document field.
# This allows efficient filtering/deletion by document name.
try:
    qdrant_client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="document",
        field_schema=PayloadSchemaType.KEYWORD,
    )
except Exception:
    # Ignore the error if the index already exists.
    pass


# Create an index for the PostgreSQL document ID.
# This allows efficient filtering/deletion by exact document ID.
try:
    qdrant_client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="document_id",
        field_schema=PayloadSchemaType.INTEGER,
    )
except Exception:
    # Ignore the error if the index already exists.
    pass


def delete_document_vectors(document_id: int) -> None:
    """
    Delete all Qdrant vectors belonging to a PostgreSQL document ID.
    """

    if document_id <= 0:
        raise ValueError("document_id must be a positive integer.")

    qdrant_client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id),
                )
            ]
        ),
        wait=True,
    )