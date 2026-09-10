import sqlite3
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]

CACHE_DIR = PROJECT_ROOT / "data" / "processed" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

CACHE_DB = CACHE_DIR / "rag_cache.db"

KNOWLEDGE_BASE_VERSION = "v1"


def get_connection():
    """Create a connection to the SQLite cache database."""

    return sqlite3.connect(CACHE_DB)


def initialize_cache():
    """Create the answer cache table if it does not exist."""

    connection = get_connection()

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS answer_cache (
            question TEXT NOT NULL,
            knowledge_base_version TEXT NOT NULL,
            answer TEXT NOT NULL,
            provider TEXT NOT NULL,
            sources TEXT,
            frequency INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (question, knowledge_base_version)
        )
        """
    )

    connection.commit()
    connection.close()


def get_cached_answer(question: str):
    """
    Return a cached answer if the exact question exists
    for the current knowledge-base version.

    Increment frequency whenever the cached answer is used.
    """

    connection = get_connection()

    row = connection.execute(
        """
        SELECT answer, provider, sources, frequency
        FROM answer_cache
        WHERE question = ?
        AND knowledge_base_version = ?
        """,
        (question.strip(), KNOWLEDGE_BASE_VERSION),
    ).fetchone()

    if row:
        connection.execute(
            """
            UPDATE answer_cache
            SET frequency = frequency + 1,
                updated_at = ?
            WHERE question = ?
            AND knowledge_base_version = ?
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                question.strip(),
                KNOWLEDGE_BASE_VERSION,
            ),
        )

        connection.commit()

        row = (
            row[0],
            row[1],
            row[2],
            row[3] + 1,
        )

    connection.close()

    return row

def save_answer(
    question: str,
    answer: str,
    provider: str,
    sources: str = "",
):
    """Save a new answer or update an existing cached answer."""

    now = datetime.now(timezone.utc).isoformat()

    connection = get_connection()

    connection.execute(
        """
        INSERT INTO answer_cache (
            question,
            knowledge_base_version,
            answer,
            provider,
            sources,
            frequency,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)

        ON CONFLICT(question, knowledge_base_version)
        DO UPDATE SET
            answer = excluded.answer,
            provider = excluded.provider,
            sources = excluded.sources,
            frequency = answer_cache.frequency + 1,
            updated_at = excluded.updated_at
        """,
        (
            question.strip(),
            KNOWLEDGE_BASE_VERSION,
            answer,
            provider,
            sources,
            now,
            now,
        ),
    )

    connection.commit()
    connection.close()


def get_frequently_asked_questions(limit: int = 5):
    """Return the most frequently asked questions."""

    connection = get_connection()

    rows = connection.execute(
        """
        SELECT question, answer, provider, frequency
        FROM answer_cache
        WHERE knowledge_base_version = ?
        ORDER BY frequency DESC, updated_at DESC
        LIMIT ?
        """,
        (KNOWLEDGE_BASE_VERSION, limit),
    ).fetchall()

    connection.close()

    return rows

initialize_cache()