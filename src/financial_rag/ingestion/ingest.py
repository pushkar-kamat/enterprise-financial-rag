import uuid
from pathlib import Path

from qdrant_client.models import PointStruct

from financial_rag.embeddings.model import embedding_model
from financial_rag.ingestion.loaders import load_document
from financial_rag.rag.chunker import chunk_records
from financial_rag.vectorstore.qdrant import (
    COLLECTION_NAME,
    qdrant_client,
)


def ingest_document(
    file_path: Path,
    document_id: int,
):
    """
    Ingest a document into Qdrant.

    The PostgreSQL document_id is attached to every Qdrant
    payload so that vectors can later be traced back to the
    exact document record and safely deleted.
    """

    file_path = Path(file_path)

    if not file_path.exists():
        raise FileNotFoundError(
            f"File not found: {file_path}"
        )

    if document_id <= 0:
        raise ValueError(
            "document_id must be a positive integer."
        )

    # 1. Load document
    records = load_document(file_path)

    if not records:
        raise ValueError(
            f"No content could be extracted from {file_path.name}."
        )

    # 2. Convert records into RAG chunks
    chunks = chunk_records(
        [record.__dict__ for record in records]
    )

    if not chunks:
        raise ValueError(
            f"No chunks were generated from {file_path.name}."
        )

    # 3. Create embeddings
    texts = [
        chunk.page_content
        for chunk in chunks
        if chunk.page_content.strip()
    ]

    if not texts:
        raise ValueError(
            f"No usable text was found in {file_path.name}."
        )

    embeddings = embedding_model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    # 4. Create Qdrant points
    points = []

    for chunk, embedding in zip(
        chunks,
        embeddings,
        strict=True,
    ):
        payload = {
            # PostgreSQL document identity.
            # This is the authoritative identifier used
            # for document-level management and deletion.
            "document_id": document_id,

            "text": chunk.page_content,
            **chunk.metadata,
        }

        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding.tolist(),
                payload=payload,
            )
        )

    # 5. Store vectors in Qdrant
    qdrant_client.upsert(
        collection_name=COLLECTION_NAME,
        points=points,
    )

    return {
        "document_id": document_id,
        "file": file_path.name,
        "chunks": chunks,
        "chunk_count": len(chunks),
    }