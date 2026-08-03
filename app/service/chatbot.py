# app/services/chatbot.py
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from config.config import Config

PERSIST_DIR = Config.PERSIST_DIR
EMBEDDING_MODEL = Config.EMBEDDING_MODEL

embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
db = Chroma(persist_directory=PERSIST_DIR, embedding_function=embeddings)

def ask(query, k=6):
    results = db.similarity_search_with_score(query, k=k)
    response = []
    for doc, score in results:
        meta = doc.metadata
        response.append({
            "titre": meta.get("titre", ""),
            "chapitre": meta.get("chapitre", ""),
            "article": meta.get("article", ""),
            "contenu": doc.page_content,
            "doc": meta.get("doc", ""),
            "pages": meta.get("pages", []) if isinstance(meta.get("pages"), list) else [meta.get("pages")] if meta.get("pages") else []
        })
    return response
