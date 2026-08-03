# app/utils/transformers_model_manager.py

from pathlib import Path
from sentence_transformers import SentenceTransformer

_sentence_transformer_models = {}  # global cache dictionary for multiple models

def get_sentence_transformer_model(model_path: str | Path = None):
    """
    Load and cache a SentenceTransformer model for embeddings.

    Args:
        model_path (str | Path): Local path of the model to load.
                                 Default = google/embeddinggemma-300m

    Returns:
        SentenceTransformer: Loaded model instance.
    """
    global _sentence_transformer_models

    if model_path is None:
        model_path = "google/embeddinggemma-300m"

    model_key = str(model_path)
    if model_key not in _sentence_transformer_models:
        print(f"[INFO] Loading embedding model from: {model_key} ...")
        _sentence_transformer_models[model_key] = SentenceTransformer(model_key)
        print(f"[OK] Model {model_key} loaded successfully.")

    return _sentence_transformer_models[model_key]



# app/utils/transformers_model_manager.py
#
# import requests
# from functools import lru_cache
# import os
#
# # Example: http://localhost:11434  or your GPU server IP
# OLLAMA_URL = os.getenv("OLLAMA_URL", "https://gemmaembeedingforloi-uri8hi-11434.svc-usw2.nicegpu.com/")
# EMBEDDING_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "embeddinggemma")
#
#
# class OllamaEmbeddingProvider:
#     """Drop-in replacement for SentenceTransformer using Ollama /api/embed."""
#
#     def __init__(self, base_url: str, model_name: str):
#         self.base_url = base_url.rstrip("/")
#         self.model_name = model_name
#
#     def encode(self, texts):
#         """Accept string or list of strings and return vector(s)."""
#         if isinstance(texts, str):
#             texts = [texts]
#
#         results = []
#
#         for t in texts:
#             payload = {
#                 "model": self.model_name,
#                 "input": t
#             }
#
#             response = requests.post(
#                 f"{self.base_url}/api/embed",
#                 json=payload
#             )
#
#             if response.status_code != 200:
#                 raise RuntimeError(
#                     f"Ollama /api/embed error {response.status_code}: {response.text}"
#                 )
#
#             data = response.json()
#
#             # Expected: { "embeddings": [ [numbers...] ] }
#             if "embeddings" not in data or not data["embeddings"]:
#                 raise RuntimeError(f"Ollama returned invalid embedding: {data}")
#
#             # Take the first (and only) embedding from the list
#             vector = data["embeddings"][0]
#
#             if len(vector) == 0:
#                 raise RuntimeError("Embedding returned is empty (dim=0).")
#
#             results.append(vector)
#
#         # Return one vector or list of vectors
#         return results[0] if len(results) == 1 else results
#
#
# @lru_cache(maxsize=1)
# def get_sentence_transformer_model():
#     print(f"🔥 Using Ollama embedding model: {EMBEDDING_MODEL} from {OLLAMA_URL}")
#     return OllamaEmbeddingProvider(OLLAMA_URL, EMBEDDING_MODEL)