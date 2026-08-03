# utils/transfromersearch.py
#
# Semantic search helper using local ChromaDB (replaces Qdrant).
# ChromaDB is configured with cosine distance; score = 1 - distance
# so higher scores still mean better matches, matching the old behaviour.

from utils.chroma_client_manager import get_chroma_collection
from utils.transformers_model_manager import get_sentence_transformer_model


def sentence_transformer_search(collection_name, modelexecute, query, limit=100):
    """
    Search a ChromaDB collection using a SentenceTransformer embedding.

    Args:
        collection_name: ChromaDB collection to query.
        modelexecute:    Model name / path forwarded to get_sentence_transformer_model().
        query:           Plain-text search query.
        limit:           Maximum number of results to return.

    Returns:
        List of result dicts with the same keys as the former Qdrant version.
    """
    print('Model search =====>', collection_name, modelexecute, query)

    collection = get_chroma_collection(collection_name)
    model = get_sentence_transformer_model(modelexecute)

    print('Problem source  : ====>', query, collection_name)

    query_embedding = model.encode(query).tolist()

    # Clamp n_results to the actual collection size to avoid ChromaDB errors
    # when the collection has fewer documents than `limit`.
    doc_count = collection.count()
    n_results = min(limit, doc_count) if doc_count > 0 else 1

    raw = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=["metadatas", "distances"],
    )

    ids        = raw.get("ids", [[]])[0]
    distances  = raw.get("distances", [[]])[0]
    metadatas  = raw.get("metadatas", [[]])[0]

    resultes = []
    for doc_id, distance, metadata in zip(ids, distances, metadatas):
        try:
            score = 1.0 - distance  # cosine similarity: higher = better
            result_dict = {
                "ID":             doc_id,
                "Score":          score,
                "La_loi":         metadata.get("reference", ""),
                "Paragraphe":     metadata.get("paragraph", ""),
                "titre":          metadata.get("titre", ""),
                "section_text":   metadata.get("section", ""),
                "section_label":  metadata.get("section_label", ""),
                "source":         metadata.get("source", ""),
                "numero_article": metadata.get("numero_article", ""),
                "collection":     collection_name,
                "hyperlink":      str(metadata.get("hyperlink", "")),
                "model":          "sentence-transformer",
            }
            resultes.append(result_dict)
        except Exception as e:
            print(f"Error occurred: {e}")

    return resultes
