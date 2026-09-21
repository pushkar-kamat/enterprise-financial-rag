from collections import defaultdict
from pathlib import Path

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Keep the exact splitter configuration from 02_text_splitting(6).ipynb
TEXT_SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=1200,
    chunk_overlap=200,
    separators=[
        "\n\n",
        "\n",
        ". ",
        " ",
        "",
    ],
)


def record_to_document(record: dict) -> Document:
    """
    Convert one normalized record into a LangChain Document.
    """

    metadata = {
        "document": record.get("document"),
        "file_type": record.get("file_type"),
        "page": record.get("page"),
        "sheet": record.get("sheet"),
        "row_start": record.get("row_start"),
        "row_end": record.get("row_end"),
        "content_type": record.get("content_type"),
        "section": record.get("section"),
        "image_path": record.get("image_path"),
        "source_path": record.get("source_path"),
        "table_id": record.get("table_id"),
    }

    return Document(
        page_content=record["text"],
        metadata=metadata,
    )


def group_text_records(records: list[dict]) -> list[dict]:
    """
    Group text records belonging to the same document/section/page context.

    Structured records such as tables and rows remain intact.
    """

    grouped = defaultdict(list)
    structured_records = []

    for record in records:
        content_type = record.get("content_type")

        # Images are handled separately later.
        if content_type == "image":
            continue

        # Keep structured records intact.
        if content_type in {"table", "structured_row"}:
            structured_records.append(record)
            continue

        key = (
            record.get("document"),
            record.get("page"),
            record.get("section"),
        )

        grouped[key].append(record)

    grouped_records = []

    for key, group in grouped.items():
        group = sorted(
            group,
            key=lambda r: (
                r.get("page") or 0,
            ),
        )

        text = "\n\n".join(
            record["text"].strip()
            for record in group
            if record.get("text")
        )

        if not text:
            continue

        first = group[0]

        grouped_records.append(
            {
                "text": text,
                "document": first.get("document"),
                "file_type": first.get("file_type"),
                "page": first.get("page"),
                "sheet": first.get("sheet"),
                "row_start": first.get("row_start"),
                "row_end": first.get("row_end"),
                "content_type": "text",
                "section": first.get("section"),
                "image_path": first.get("image_path"),
                "source_path": first.get("source_path"),
                "table_id": first.get("table_id"),
            }
        )

    return grouped_records + structured_records


def split_grouped_document(records: list[dict]) -> list[Document]:
    """
    Convert normalized records into final RAG chunks.
    """

    documents = []

    for record in records:
        content_type = record.get("content_type")

        # Structured content should remain as one chunk.
        if content_type in {"table", "structured_row"}:
            document = record_to_document(record)
            documents.append(document)
            continue

        document = record_to_document(record)

        chunks = TEXT_SPLITTER.split_documents([document])

        documents.extend(chunks)

    # Add deterministic chunk IDs and character counts.
    final_chunks = []

    for index, chunk in enumerate(documents):

        document_name = chunk.metadata.get("document") or "unknown"

        chunk.metadata["chunk_id"] = index
        chunk.metadata["char_count"] = len(chunk.page_content)

        final_chunks.append(chunk)

    return final_chunks


def chunk_records(records: list[dict]) -> list[Document]:
    """
    Complete normalized-record → RAG-chunk pipeline.
    """

    grouped_records = group_text_records(records)

    chunks = split_grouped_document(grouped_records)

    return chunks