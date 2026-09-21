import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATABASE_PATH = PROJECT_ROOT / "data" / "conversations.db"

DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    connection = get_connection()

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            is_pinned INTEGER NOT NULL DEFAULT 0
        )
        """
    )

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            provider TEXT,
            sources TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id)
                REFERENCES conversations(id)
                ON DELETE CASCADE
        )
        """
    )

    connection.commit()
    connection.close()


initialize_database()