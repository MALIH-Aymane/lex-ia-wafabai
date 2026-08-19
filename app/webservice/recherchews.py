# webservice/recherchews.py
#
# Search endpoints — migrated from Qdrant to local ChromaDB.
#
# Filter format (server-side):
#   Each filter is a plain dict  {"key": "<field>", "value": "<val>"}
#   Multiple filters are AND-ed together via ChromaDB's $and operator.

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from utils.chroma_client_manager import get_chroma_collection
from utils.transformers_model_manager import get_sentence_transformer_model
from llm_utils.llm_router import LLMRouter
from repository.questionrepository import add_question, get_question_by_id
from utils.decorators import role_required
from datetime import datetime
import traceback


recherche_ws = Blueprint('recherchews', __name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_where_clause(filters: list) -> dict | None:
    """
    Convert a list of {"key": k, "value": v} dicts to a ChromaDB where clause.

    Examples
    --------
    []                                          → None  (no filter)
    [{"key": "langue", "value": "fr"}]         → {"langue": {"$eq": "fr"}}
    [{"key": "a", "value": "1"},
     {"key": "b", "value": "2"}]               → {"$and": [{"a":{"$eq":"1"}},
                                                            {"b":{"$eq":"2"}}]}
    """
    if not filters:
        return None

    conditions = [{f["key"]: {"$eq": f["value"]}} for f in filters if "key" in f and "value" in f]

    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}


def perform_search_and_get_results(collection_name, query, langue, filters=None, limit=30):
    """
    Query a ChromaDB collection and return results in the same format
    previously returned by the Qdrant query_points() call.

    Args:
        collection_name: ChromaDB collection name.
        query:           Plain-text search query.
        langue:          Language hint (kept for API compatibility; not filtered by default).
        filters:         List of {"key": k, "value": v} equality filter dicts.
        limit:           Max results to return.

    Returns:
        List of {"score": float, "reponse": dict, "result_id": str}
    """
    if filters is None:
        filters = []

    print("ChromaDB looking for:", collection_name, query, filters)

    collection = get_chroma_collection(collection_name)

    # Clamp n_results to avoid errors when collection is smaller than limit
    doc_count = collection.count()
    n_results = min(limit, doc_count) if doc_count > 0 else 1

    # Look up embedding model from SQL DB VectorCollection
    from models.vector_collection import VectorCollection
    col_record = VectorCollection.query.filter_by(name=collection_name).first()
    model_path = col_record.embedding_model if col_record else "google/embeddinggemma-300m"
    
    current_model = get_sentence_transformer_model(model_path)
    query_embedding = current_model.encode(query).tolist()
    where_clause = _build_where_clause(filters)

    query_kwargs = dict(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=["metadatas", "distances"],
    )
    if where_clause:
        query_kwargs["where"] = where_clause

    raw = collection.query(**query_kwargs)

    ids       = raw.get("ids", [[]])[0]
    distances = raw.get("distances", [[]])[0]
    metadatas = raw.get("metadatas", [[]])[0]

    def _clean_meta_value(val):
        if val is None:
            return ""
        if isinstance(val, float):
            return str(int(val)) if val.is_integer() else str(val)
        val_str = str(val).strip()
        if val_str.endswith(".0") and val_str[:-2].isdigit():
            return val_str[:-2]
        return val_str

    results = []
    for doc_id, distance, metadata in zip(ids, distances, metadatas):
        score = 1.0 - distance  # cosine similarity (higher = better)
        cleaned_meta = {k: _clean_meta_value(v) for k, v in (metadata or {}).items()}
        results.append({
            "score":     score,
            "reponse":   cleaned_meta,
            "result_id": doc_id,
        })

    return results


# ---------------------------------------------------------------------------
# Grouping helpers (unchanged — work on the normalised result dicts above)
# ---------------------------------------------------------------------------

def build_group_key(payload):
    """Group strictly by the real grouping field (document-level)."""
    return (
        payload.get("grouping"),
        extract_document_id(payload)
    )


def extract_document_id(payload):
    """Returns the first existing stable document identifier from payload."""
    for key in ["grouping", "uuid", "document_uuid", "source_path"]:
        if payload.get(key):
            return payload.get(key)
    # fallback (legacy behaviour)
    return payload.get("levelvalue5")


def group_and_sort_hits_to_list(results, group_bonus_weight=0.2):
    grouped = {}

    for hit in results:
        payload = hit["reponse"]
        score   = hit["score"]

        group_key = build_group_key(payload)

        if group_key not in grouped:
            grouped[group_key] = {
                "group_key":   group_key,
                "document":    payload.get("levelvalue5"),
                "source":      payload.get("document_url"),
                "document_id": extract_document_id(payload),
                "hierarchy":   None,
                "records":     [],
                "max_score":   0.0,
            }

        grouped[group_key]["records"].append({
            "result_id": hit["result_id"],
            "score":     score,
            "payload":   payload,
            "hierarchy": {
                f"level{i}": {
                    "name":  payload.get(f"levelname{i}"),
                    "value": payload.get(f"levelvalue{i}"),
                }
                for i in range(1, 7)
                if payload.get(f"levelvalue{i}") is not None
            },
        })

        grouped[group_key]["max_score"] = max(grouped[group_key]["max_score"], score)

    for group in grouped.values():
        size_bonus = group_bonus_weight * len(group["records"])
        group["adjusted_score"] = group["max_score"] + size_bonus
        group["records"].sort(key=lambda r: r["score"], reverse=True)

    return sorted(grouped.values(), key=lambda g: g["adjusted_score"], reverse=True)


# ---------------------------------------------------------------------------
# 🧠 Simple Semantic Search
# ---------------------------------------------------------------------------

@recherche_ws.route('/recherche_simple', methods=['POST'])
@role_required('Administrateur', 'Responsable juridique')
def simple_search():
    try:
        data = request.get_json()

        query           = data.get('query', '').strip()
        limit           = int(data.get('limit', 30))
        langue          = data.get('langue', 'fr')
        filters         = data.get('filters', [])      # list of {"key":…, "value":…}
        question_id     = data.get('question_id')
        collection_name = data.get('collection_name', 'loi-maroc-2025').strip()
        grouping        = data.get('grouping', '').strip()

        # Append grouping filter if specified
        if grouping:
            filters = list(filters) + [{"key": "grouping", "value": grouping}]

        user = get_jwt_identity()
        date = datetime.utcnow()

        if not query:
            return jsonify({'error': 'Missing query parameter'}), 400

        # 1. Load existing question if question_id provided
        question_record = None
        if question_id:
            question_record = get_question_by_id(question_id)
            if not question_record:
                return jsonify({'error': 'Question ID not found'}), 404

        # 2. Otherwise create a new question record
        if not question_record:
            question_record = add_question(date, query, user, str(filters), langue)

        # 3. Perform vector search
        search_results = perform_search_and_get_results(
            collection_name=collection_name,
            query=query,
            langue=langue,
            filters=filters,
            limit=limit,
        )

        if isinstance(question_record, dict):
            question_data = question_record
        elif hasattr(question_record, "as_dict"):
            question_data = question_record.as_dict()
        else:
            question_data = {"query": query, "user": user, "langue": langue}

        return jsonify({'results': search_results, 'question': question_data}), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# 🧠 Jurisprudence Search
# ---------------------------------------------------------------------------

@recherche_ws.route('/jurispridance', methods=['POST'])
@jwt_required()
def jurispridance_search():
    try:
        collection_name = 'Jurispridance_marocaine'
        data = request.get_json()

        query   = data.get('query', '').strip()
        limit   = int(data.get('limit', 30))
        langue  = data.get('langue', 'fr')
        filters = data.get('filters', [])

        user = get_jwt_identity()
        date = datetime.utcnow()

        if not query:
            return jsonify({'error': 'Missing query parameter'}), 400

        search_results = perform_search_and_get_results(
            collection_name=collection_name,
            query=query,
            langue=langue,
            filters=filters,
            limit=limit,
        )

        question_record = add_question(date, query, user, str(filters), langue)

        if isinstance(question_record, dict):
            question_data = question_record
        elif hasattr(question_record, "as_dict"):
            question_data = question_record.as_dict()
        else:
            question_data = {"query": query, "user": user, "langue": langue}

        return jsonify({'results': search_results, 'question': question_data}), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# 🧠 Interpretation / LLM Report Generation
# ---------------------------------------------------------------------------

@recherche_ws.route('/recherche_interpretation', methods=['POST'])
@role_required('Administrateur', 'Responsable juridique')
def generate_report():
    data = request.get_json() or {}

    context    = data.get('context', [])
    model_name = data.get('model_name', '')
    query      = data.get('query', '').strip()

    if not context or not query:
        return jsonify({"error": "Missing context or query"}), 400

    documents = []

    for item in context:
        reponse       = item.get("reponse") if isinstance(item, dict) and "reponse" in item else item
        if not isinstance(reponse, dict):
            continue

        doc_uuid = reponse.get("document_uuid") or reponse.get("reference") or "doc"
        doc_name = reponse.get("reference") or reponse.get("levelvalue5") or reponse.get("document") or doc_uuid
        source   = reponse.get("hyperlink") or reponse.get("document_url") or reponse.get("source") or ""

        text_content = reponse.get("contenu") or reponse.get("paragraph") or ""
        article_val  = reponse.get("levelvalue6") or reponse.get("numero_article") or ""
        page_val     = reponse.get("pages") or reponse.get("page") or ""
        score_val    = float(item.get("score", 1.0)) if isinstance(item, dict) and "score" in item else 1.0

        documents.append({
            "document_id":   str(doc_uuid),
            "document_name": str(doc_name),
            "source":        str(source),
            "extraits":      [{
                "article": str(article_val),
                "contenu": str(text_content),
                "page":    str(page_val),
                "score":   round(score_val, 3),
            }]
        })

    if not documents:
        return jsonify({"error": "No valid documents or references selected"}), 400

    from concurrent.futures import ThreadPoolExecutor
    from flask import current_app
    app = current_app._get_current_object()
    llm_router = LLMRouter()

    # Step 1: Analyze each reference in parallel
    def analyze_item(doc):
        doc_name = doc["document_name"]
        ext = doc["extraits"][0]
        art = ext["article"] or "Non spécifié"
        pg = ext["page"] or "Non spécifié"
        txt = ext["contenu"]

        prompt_indiv = f"""Tu es un expert senior en réglementation bancaire marocaine et en conformité.
Analyse l'extrait réglementaire suivant issu du document '{doc_name}' (Article: {art}, Page: {pg}) au regard de la question posée : "{query}".

Extrait réglementaire :
\"\"\"
{txt}
\"\"\"

Ressors les obligations applicables, interdictions et points de vigilance majeurs liés à cet extrait. Sois concis, factuel, et base-toi uniquement sur l'extrait fourni. N'invente rien."""
        
        with app.app_context():
            try:
                analysis_text = llm_router.generate(model_name, prompt_indiv)
                return {
                    "document_name": doc_name,
                    "article": art,
                    "page": pg,
                    "analysis": analysis_text
                }
            except Exception as e:
                return {
                    "document_name": doc_name,
                    "article": art,
                    "page": pg,
                    "analysis": f"Erreur lors de l'analyse individuelle : {str(e)}"
                }

    with ThreadPoolExecutor(max_workers=min(5, len(documents))) as executor:
        individual_results = list(executor.map(analyze_item, documents))

    # Step 2: Compile the individual analyses
    compiled_analyses_list = []
    for res in individual_results:
        compiled_analyses_list.append(f"""### Référence : {res['document_name']} (Article: {res['article']}, Page: {res['page']})
Analyse LLM individuelle :
{res['analysis']}
--------------------------------------------------""")
    
    compiled_analyses_text = "\n\n".join(compiled_analyses_list)

    # Step 3: Global synthesis
    prompt_synth = f"""Tu es un expert senior en réglementation bancaire marocaine et en conformité, opérant sous la supervision de Bank Al-Maghrib.
Rédige un rapport de synthèse juridique structuré et exhaustif en te basant STRICTEMENT sur les analyses individuelles des extraits réglementaires fournies ci-dessous.

QUESTION DE L'UTILISATEUR :
"{query}"

ANALYSES PAR RÉFÉRENCE RÉGLEMENTAIRE :
{compiled_analyses_text}

Tu devez respecter STRICTEMENT le format de réponse suivant et utiliser exactement ces balises de section :

[TITRE]
Intitulé clair et précis de la question analysée.

[SYNTHÈSE EXÉCUTIVE]
(5 à 7 lignes maximum)
Résumé clair, neutre et professionnel destiné à un dirigeant bancaire.

[ANALYSE JURIDIQUE DÉTAILLÉE]
Une analyse synthétique des dispositions réglementaires pertinentes basées sur les références fournies (mentionner la source et l'article).

[IMPACTS POUR LA BANQUE]
- Obligations réglementaires identifiées
- Interdictions explicites
- Points de vigilance et de conformité

[LIMITES ET INCERTITUDES]
- Éléments non couverts par les textes fournis
- Ambiguïtés ou zones nécessitant clarification

[CONCLUSION OPÉRATIONNELLE]
- Ce que la banque doit/peut faire
- Ce qu'elle ne doit/peut pas faire
- Ce qui nécessite une validation ou étude complémentaire"""

    try:
        answer = llm_router.generate(model_name, prompt_synth)
    except Exception as e:
        answer = f"Erreur lors de la génération de la synthèse globale : {str(e)}"

    return jsonify({
        "query":           query,
        "answer":          answer,
        "documents_used":  [
            {
                "document_id":   d["document_id"],
                "document_name": d["document_name"],
                "source":        d["source"],
            }
            for d in documents
        ],
    })


# ---------------------------------------------------------------------------
# 🧠 Grouped Search
# ---------------------------------------------------------------------------

@recherche_ws.route('/grouped_search', methods=['POST'])
@role_required('Administrateur', 'Responsable juridique')
def chat_grouped():
    try:
        collection_name = 'lex-ia-total'
        data = request.get_json()

        query       = data.get('query', '').strip()
        limit       = int(data.get('limit', 100))
        langue      = data.get('langue', 'fr')
        filters     = data.get('filters', [])   # list of {"key":…, "value":…}
        question_id = data.get('question_id')

        user = get_jwt_identity()
        date = datetime.utcnow()

        if not query:
            return jsonify({'error': 'Missing query parameter'}), 400

        # 1. Load existing question if question_id provided
        question_record = None
        if question_id:
            question_record = get_question_by_id(question_id)
            if not question_record:
                return jsonify({'error': 'Question ID not found'}), 404

        # 2. Otherwise create a new question record
        if not question_record:
            question_record = add_question(date, query, user, str(filters), langue)

        # 3. Add the server-side collection filter
        filters.append({"key": "collection", "value": "BAM Barid Bank"})

        results = perform_search_and_get_results(
            collection_name=collection_name,
            query=query,
            langue=langue,
            filters=filters,
            limit=limit,
        )

        if isinstance(question_record, dict):
            question_data = question_record
        elif hasattr(question_record, "as_dict"):
            question_data = question_record.as_dict()
        else:
            question_data = {"query": query, "user": user, "langue": langue}

        grouped_hits = group_and_sort_hits_to_list(results, 0.05)

        return jsonify({'question': question_data, 'results': grouped_hits})

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500