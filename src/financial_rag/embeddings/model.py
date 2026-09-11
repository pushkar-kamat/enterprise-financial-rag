from sentence_transformers import SentenceTransformer


EMBEDDING_MODEL_NAME = "BAAI/bge-large-en-v1.5"

embedding_model = SentenceTransformer(
    EMBEDDING_MODEL_NAME
)