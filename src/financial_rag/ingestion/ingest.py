from pathlib import Path
import uuid

from financial_rag.embeddings.model import embedding_model
from qdrant_client.models import PointStruct

from financial_rag.ingestion.loaders import load_document
from financial_rag.rag.chunker import chunk_records
from financial_rag.vectorstore.qdrant import qdrant_client, COLLECTION_NAME



def ingest_document(file_path: Path):
    # 1. Load document
    records = load_document(file_path)

    # 2. Convert records into chunks
    chunks = chunk_records(
        [record.__dict__ for record in records]
    )

    # 3. Create embeddings
    texts = [chunk.page_content for chunk in chunks]

    embeddings = embedding_model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    # 4. Create Qdrant points
    points = []

    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        payload = {
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
        "file": file_path.name,
        "chunks": chunks,
        "chunk_count": len(chunks),
    }