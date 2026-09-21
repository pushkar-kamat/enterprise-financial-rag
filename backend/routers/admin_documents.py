from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.auth import require_admin
from backend.db import get_db
from backend.models import AuditLog, Document, User
from backend.storage import delete_file, upload_file
from financial_rag.ingestion.ingest import ingest_document
from financial_rag.vectorstore.qdrant import delete_document_vectors

router = APIRouter(
    prefix="/api/admin/documents",
    tags=["Admin Documents"],
)


ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".txt",
    ".md",
    ".markdown",
    ".csv",
    ".xlsx",
    ".xls",
}

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Upload and ingest a document as an administrator.

    Flow:
    1. Validate filename and extension.
    2. Enforce file-size limit while writing the temporary file.
    3. Create PostgreSQL document record.
    4. Upload original file to S3.
    5. Ingest document into Qdrant.
    6. Mark document as ready.
    7. Write an audit log.
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="A filename is required.",
        )

    original_filename = Path(file.filename).name

    if original_filename in {"", ".", ".."}:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename.",
        )

    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Allowed types: PDF, DOCX, TXT, MD, CSV, XLSX, XLS."
            ),
        )

    document = Document(
        filename=original_filename,
        storage_key="pending",
        status="processing",
        uploaded_by=current_user.id,
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    storage_key = f"documents/{document.id}/{original_filename}"

    document.storage_key = storage_key
    db.commit()

    temporary_path = None
    s3_uploaded = False

    try:
        total_size = 0

        with NamedTemporaryFile(
            suffix=extension,
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)

            while chunk := file.file.read(1024 * 1024):
                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="File is too large. Maximum size is 25 MB.",
                    )

                temporary_file.write(chunk)

        upload_file(
            file_path=temporary_path,
            storage_key=storage_key,
            content_type=file.content_type,
        )

        s3_uploaded = True

        ingestion_result = ingest_document(
            temporary_path,
            document.id,
        )

        document.status = "ready"

        db.add(
            AuditLog(
                user_id=current_user.id,
                action="document.upload",
                resource_type="document",
                resource_id=str(document.id),
            )
        )

        db.commit()
        db.refresh(document)

        return {
            "id": document.id,
            "filename": document.filename,
            "storage_key": document.storage_key,
            "status": document.status,
            "uploaded_by": document.uploaded_by,
            "chunk_count": ingestion_result["chunk_count"],
        }

    except HTTPException:
        document.status = "failed"
        db.commit()

        if s3_uploaded:
            try:
                delete_file(storage_key)
            except Exception:
                pass

        raise

    except Exception as error:
        document.status = "failed"
        db.commit()

        if s3_uploaded:
            try:
                delete_file(storage_key)
            except Exception:
                pass

        print("DOCUMENT PROCESSING ERROR:", repr(error))

        raise HTTPException(
            status_code=500,
            detail="Document processing failed.",
        ) from error
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()

        file.file.close()


@router.delete(
    "/{document_id}",
)
def delete_document(
    document_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Delete a document and all associated data.

    Flow:
    1. Verify the document exists.
    2. Delete Qdrant vectors.
    3. Delete the original file from S3.
    4. Delete the PostgreSQL document record.
    5. Write an audit log.
    """

    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    storage_key = document.storage_key

    try:
        # Delete all vectors associated with this document.
        delete_document_vectors(document.id)

        # Delete the original file from S3.
        delete_file(storage_key)

        # Record the deletion before removing the database row.
        db.add(
            AuditLog(
                user_id=current_user.id,
                action="document.delete",
                resource_type="document",
                resource_id=str(document.id),
            )
        )

        db.delete(document)
        db.commit()

        return {
            "status": "deleted",
            "document_id": document_id,
        }

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Document deletion failed.",
        ) from error


@router.get("")
def list_documents(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    documents = (
        db.query(Document)
        .order_by(Document.created_at.desc())
        .all()
    )

    return {
        "documents": [
            {
                "id": document.id,
                "filename": document.filename,
                "status": document.status,
                "storage_key": document.storage_key,
                "uploaded_by": document.uploaded_by,
                "created_at": document.created_at,
                "updated_at": document.updated_at,
            }
            for document in documents
        ]
    }


@router.get("/{document_id}")
def get_document(
    document_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found.",
        )

    return {
        "id": document.id,
        "filename": document.filename,
        "status": document.status,
        "storage_key": document.storage_key,
        "uploaded_by": document.uploaded_by,
        "created_at": document.created_at,
        "updated_at": document.updated_at,
    }