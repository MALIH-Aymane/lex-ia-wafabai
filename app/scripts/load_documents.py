import os
import pandas as pd
from langchain.docstore.document import Document
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

# Configurations
DATA_DIR = "data"
PERSIST_DIR = "chroma_storage"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

def clean_str(val) -> str:
    if pd.isna(val) or val is None:
        return ""
    if isinstance(val, float):
        if val.is_integer():
            return str(int(val))
        return str(val)
    val_str = str(val).strip()
    if val_str.endswith(".0") and val_str[:-2].isdigit():
        return val_str[:-2]
    return val_str

def parse_pages(pages_str):
    if pd.isna(pages_str):
        return []
    try:
        pages = eval(str(pages_str))
        return pages if isinstance(pages, list) else [pages]
    except:
        try:
            return [int(p.strip()) for p in str(pages_str).split(",") if p.strip().isdigit()]
        except:
            return []

def load_csv(filepath: str) -> list:
    df = pd.read_csv(filepath)
    df.columns = [c.strip().lower() for c in df.columns]

    documents = []
    for _, row in df.iterrows():
        text = clean_str(row.get('contenu'))
        if not text:
            continue

        meta = {
            'doc': (
                clean_str(row.get('doc'))
                if pd.notna(row.get('doc')) and clean_str(row.get('doc'))
                else os.path.splitext(os.path.basename(filepath))[0]
            ),
            'titre': clean_str(row.get('titre')),
            'chapitre': clean_str(row.get('chapitre')),
            'article': clean_str(row.get('article')),
            'sous_titre1': clean_str(row.get('sous_titre1')),
            'sous_titre2': clean_str(row.get('sous_titre2')),
            'sous_titre3': clean_str(row.get('sous_titre3')),
            'pages': ", ".join(map(str, parse_pages(row.get('pages', ''))))
        }

        documents.append(Document(page_content=str(text).strip(), metadata=meta))

    print(f"📄 Loaded: {os.path.basename(filepath)} → {len(documents)} documents")
    return documents

def process_files():
    all_docs = []
    for file in os.listdir(DATA_DIR):
        if file.endswith(".csv"):
            full_path = os.path.join(DATA_DIR, file)
            documents = load_csv(full_path)
            print(f"[INFO] Loaded: {os.path.basename(full_path)} -> {len(documents)} documents")
            all_docs.extend(documents)

    print(f"[INFO] Total: {len(all_docs)} full documents")

    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    db = Chroma.from_documents(all_docs, embedding=embeddings, persist_directory=PERSIST_DIR)
    db.persist()

    print(f"[OK] Done! Stored in {PERSIST_DIR}")

if __name__ == "__main__":
    process_files()
