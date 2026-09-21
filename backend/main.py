from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.auth import require_admin, require_authenticated_user
from backend.db import get_db
from backend.models import Conversation, Message, User
from backend.routers.admin_documents import router as admin_documents_router
from backend.routers.admin_users import router as admin_users_router
from financial_rag.rag.pipeline import answer_question

load_dotenv()


app = FastAPI(
    title="Northstar Financial AI",
    description="Financial policy RAG API",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


app.include_router(admin_documents_router)
app.include_router(admin_users_router)


class ChatRequest(BaseModel):
    question: str
    conversation_id: int | None = None


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Northstar Financial AI",
    }


@app.get("/api/auth/test")
def auth_test(
    current_user=Depends(require_authenticated_user),
):
    return {
        "authenticated": True,
        "user_id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }


@app.get("/api/admin/test")
def admin_test(
    current_user=Depends(require_admin),
):
    return {
        "status": "authorized",
        "message": "Admin authentication successful.",
        "user_id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }


@app.post("/api/chat")
def chat(
    request: ChatRequest,
    current_user=Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty.",
        )

    conversation = None

    if request.conversation_id is not None:
        conversation = (
            db.query(Conversation)
            .filter(
                Conversation.id == request.conversation_id,
                Conversation.user_id == current_user.id,
            )
            .first()
        )

        if conversation is None:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found.",
            )

        if conversation.is_archived:
            raise HTTPException(
                status_code=400,
                detail="Cannot add messages to an archived conversation.",
            )

    if conversation is None:
        conversation = Conversation(
            user_id=current_user.id,
            title=question[:255],
        )

        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=question,
    )

    db.add(user_message)
    db.commit()

    try:
        result = answer_question(question)
    except Exception:
        db.rollback()
        raise

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=result["answer"],
        provider=result.get("provider"),
    )

    db.add(assistant_message)

    conversation.updated_at = datetime.now(timezone.utc)

    db.commit()

    return {
        "conversation_id": conversation.id,
        "question": question,
        "answer": result["answer"],
        "provider": result["provider"],
        "sources": result["sources"],
        "cached": result["cached"],
        "frequency": result["frequency"],
    }


@app.get("/api/conversations")
def get_conversations(
    current_user=Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == current_user.id,
            Conversation.is_archived.is_(False),
        )
        .order_by(
            Conversation.is_pinned.desc(),
            Conversation.updated_at.desc(),
        )
        .all()
    )

    return {
        "conversations": [
            {
                "id": conversation.id,
                "title": conversation.title,
                "is_pinned": conversation.is_pinned,
                "is_archived": conversation.is_archived,
                "created_at": conversation.created_at,
                "updated_at": conversation.updated_at,
            }
            for conversation in conversations
        ]
    }


@app.get("/api/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: int,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    return {
        "conversation_id": conversation.id,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "created_at": message.created_at,
            }
            for message in messages
        ],
    }


@app.get("/api/conversations/archived")
def get_archived_conversations(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == current_user.id,
            Conversation.is_archived.is_(True),
        )
        .order_by(
            Conversation.updated_at.desc(),
        )
        .all()
    )

    return {
        "conversations": [
            {
                "id": conversation.id,
                "title": conversation.title,
                "is_pinned": conversation.is_pinned,
                "is_archived": conversation.is_archived,
                "created_at": conversation.created_at,
                "updated_at": conversation.updated_at,
            }
            for conversation in conversations
        ]
    }


@app.post("/api/conversations/{conversation_id}/archive")
def archive_conversation(
    conversation_id: int,
    current_user=Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    conversation.is_archived = True
    conversation.updated_at = datetime.now(timezone.utc)

    db.commit()

    return {
        "status": "archived",
        "conversation_id": conversation.id,
    }


@app.post("/api/conversations/{conversation_id}/unarchive")
def unarchive_conversation(
    conversation_id: int,
    current_user=Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    conversation.is_archived = False
    conversation.updated_at = datetime.now(timezone.utc)

    db.commit()

    return {
        "status": "unarchived",
        "conversation_id": conversation.id,
    }