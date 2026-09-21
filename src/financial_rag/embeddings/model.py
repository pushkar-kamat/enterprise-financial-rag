from sentence_transformers import SentenceTransformer

EMBEDDING_MODEL_NAME = "BAAI/bge-base-en-v1.5"


embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)