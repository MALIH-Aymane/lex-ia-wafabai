# utils/chroma_client_manager.py
#
# Local, persistent ChromaDB client — replaces the cloud Qdrant client.
# Collections are stored in ./chroma_storage (same dir used by chatbot.py
# and scripts/load_documents.py).
#
# Usage:
#   from utils.chroma_client_manager import get_chroma_collection
#   collection = get_chroma_collection("loi-maroc-2025")
#   results = collection.query(query_embeddings=[...], n_results=30)

import chromadb

_chroma_client = None

# Must match PERSIST_DIR in config/config.py and scripts/load_documents.py
CHROMA_PERSIST_DIR = "chroma_storage"


def get_chroma_client() -> chromadb.PersistentClient:
    """Return the shared ChromaDB persistent client (singleton)."""
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
    return _chroma_client


def get_chroma_collection(collection_name: str):
    """
    Return (or create) a ChromaDB collection by name.

    Collections use **cosine** distance so similarity scores are comparable
    to the former Qdrant cosine scores (score = 1 - distance, higher = better).

    Args:
        collection_name: Name of the ChromaDB collection.

    Returns:
        chromadb.Collection
    """
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )
    return collection
