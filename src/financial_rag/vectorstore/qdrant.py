from pathlib import Path

from qdrant_client import QdrantClient


PROJECT_ROOT = Path(__file__).resolve().parents[3]

QDRANT_PATH = PROJECT_ROOT / "data" / "processed" / "vector_store" / "qdrant"
COLLECTION_NAME = "financial_policies"


qdrant_client = QdrantClient(path=str(QDRANT_PATH))