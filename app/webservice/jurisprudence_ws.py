# webservice/jurisprudence_ws.py
#
# Jurisprudence endpoints — migrated from Qdrant to local ChromaDB.
# Upsert: qdrant client.upsert(PointStruct) → collection.upsert(ids, embeddings, metadatas)

import ast
import json
from datetime import datetime
from uuid import uuid4

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from utils.extensions import db
from utils.chroma_client_manager import get_chroma_collection
from utils.transformers_model_manager import get_sentence_transformer_model

from models.question import Question, Status
from models.jurisprudence import Jurisprudence


jurisprudence_ws = Blueprint('jurisprudences', __name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _coerce_sources(value):
    """Accept list, None, or stringified list and return a Python list of strings."""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(x) for x in value]
    if isinstance(value, str):
        s = value.strip()
        if (s.startswith('[') and s.endswith(']')) or (s.startswith('(') and s.endswith(')')):
            try:
                parsed = ast.literal_eval(s)
                if isinstance(parsed, (list, tuple)):
                    return [str(x) for x in parsed]
            except Exception:
                pass
        return [s]
    return [str(value)]


def _safe_metadata(payload: dict) -> dict:
    """
    ChromaDB metadata values must be str, int, float, or bool.
    Serialize lists and non-primitive types to JSON strings.
    Drop None values (ChromaDB does not accept them).
    """
    safe = {}
    for k, v in payload.items():
        if v is None:
            continue
        if isinstance(v, (str, int, float, bool)):
            safe[k] = v
        else:
            # datetime, list, dict, … → JSON string
            safe[k] = json.dumps(v, default=str)
    return safe


# ---------------------------------------------------------------------------
# POST /responses — create a jurisprudence response
# ---------------------------------------------------------------------------

@jurisprudence_ws.route('/responses', methods=['POST'])
@jwt_required()
def create_response():
    """
    Create a Jurisprudence response.

    JSON body:
    {
      "question_id":  123,
      "provider_id":  45,                              (optional if JWT identity present)
      "sources":      ["vec_1","vec_2"] or "['vec_1']",
      "content":      "plain text answer",
      "html_content": "<p>answer</p>",
      "status":       "DRAFT" | "PUBLISHED" | "ARCHIVED"  (default: DRAFT)
    }
    """
    raw = request.get_data(as_text=True)
    raw_clean = raw.replace('\u00a0', ' ')   # replace non-breaking spaces

    try:
        data = json.loads(raw_clean)
    except json.JSONDecodeError as e:
        print("JSON decode error:", e)
        return jsonify({"error": "Invalid JSON body", "details": str(e)}), 400

    print("data received ===>", data)

    question_id = data.get('question_id')
    if not question_id:
        return jsonify({"error": "question_id is required"}), 400

    question = Question.query.get(question_id)
    if not question:
        return jsonify({"error": f"Question {question_id} not found"}), 404

    jwt_identity = get_jwt_identity()
    print("identity ===>", jwt_identity)
    provider_id = data.get('provider_id')
    if jwt_identity:
        provider_id = jwt_identity
    if provider_id is None:
        return jsonify({"error": "provider_id is required (or provide a numeric JWT identity)"}), 400

    sources      = _coerce_sources(data.get('sources'))
    content      = data.get('content')
    html_content = data.get('html_content')
    status       = (data.get('status') or "DRAFT").upper()
    allowed      = {"DRAFT", "PUBLISHED", "ARCHIVED"}
    if status not in allowed:
        return jsonify({"error": f"Invalid status '{status}'. Allowed: {', '.join(sorted(allowed))}"}), 400

    try:
        # 1. Update question status in MySQL
        question.status = Status.JURISPRUDENCE
        db.session.add(question)

        # 2. Persist jurisprudence record in MySQL
        resp = Jurisprudence(
            question_id=question_id,
            provider_id=provider_id,
            sources=sources,
            content=content,
            html_content=html_content,
            status=status,
        )
        db.session.add(resp)
        db.session.commit()

        # 3. Index the answer in ChromaDB (replaces Qdrant upsert)
        model = get_sentence_transformer_model()
        collection = get_chroma_collection("Jurispridance_marocaine")

        payload = {
            "id":           resp.id,
            "question_id":  question_id,
            "question":     question.texte,
            "provider_id":  provider_id,
            "sources":      sources,        # list → serialised to JSON str by _safe_metadata
            "content":      content,
            "html_content": html_content,
            "status":       status,
            "created_at":   resp.created_at,
            "updated_at":   resp.updated_at,
        }

        collection.upsert(
            ids=[str(uuid4())],
            embeddings=[model.encode(question.texte).tolist()],
            metadatas=[_safe_metadata(payload)],
        )

        return jsonify(resp.as_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create response", "details": str(e)}), 500


# ---------------------------------------------------------------------------
# PUT /responses/<id>/status — Update status (PUBLISHED, DRAFT, ARCHIVED)
# ---------------------------------------------------------------------------

@jurisprudence_ws.route('/responses/<int:resp_id>/status', methods=['PUT'])
@jwt_required()
def update_response_status(resp_id):
    data = request.get_json() or {}
    new_status = (data.get('status') or '').upper()

    allowed = {"DRAFT", "PUBLISHED", "ARCHIVED"}
    if new_status not in allowed:
        return jsonify({"error": f"Invalid status '{new_status}'"}), 400

    resp = Jurisprudence.query.get(resp_id)
    if not resp:
        # Fallback: check if resp_id passed is question_id
        resp = Jurisprudence.query.filter_by(question_id=resp_id).order_by(Jurisprudence.id.desc()).first()

    if not resp:
        return jsonify({"error": f"Jurisprudence response with ID {resp_id} not found"}), 404

    try:
        resp.status = new_status
        db.session.commit()

        # Update ChromaDB collection metadata
        collection = get_chroma_collection("Jurispridance_marocaine")
        # Try both int and str question_id filter
        for q_val in [resp.question_id, str(resp.question_id)]:
            try:
                items = collection.get(where={"question_id": {"$eq": q_val}})
                if items and items.get("ids"):
                    item_ids = items["ids"]
                    metadatas = items.get("metadatas", [])
                    for meta in metadatas:
                        meta["status"] = new_status
                    collection.update(ids=item_ids, metadatas=metadatas)
            except Exception:
                pass

        return jsonify({"msg": "Status updated successfully", "jurisprudence": resp.as_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to update status", "details": str(e)}), 500


# ---------------------------------------------------------------------------
# DELETE /responses/<id> — Delete jurisprudence response
# ---------------------------------------------------------------------------

@jurisprudence_ws.route('/responses/<int:resp_id>', methods=['DELETE'])
@jwt_required()
def delete_response(resp_id):
    resp = Jurisprudence.query.get(resp_id)
    if not resp:
        # Fallback: check if resp_id passed is question_id
        resp = Jurisprudence.query.filter_by(question_id=resp_id).order_by(Jurisprudence.id.desc()).first()

    if not resp:
        return jsonify({"error": f"Jurisprudence response with ID {resp_id} not found"}), 404

    q_id = resp.question_id
    try:
        db.session.delete(resp)
        db.session.commit()

        # Delete from ChromaDB
        collection = get_chroma_collection("Jurispridance_marocaine")
        for q_val in [q_id, str(q_id)]:
            try:
                collection.delete(where={"question_id": {"$eq": q_val}})
            except Exception:
                pass

        return jsonify({"msg": "Jurisprudence deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to delete jurisprudence", "details": str(e)}), 500



# ---------------------------------------------------------------------------
# POST /submit_request — Simple user submits a question request to legal team
# ---------------------------------------------------------------------------

@jurisprudence_ws.route('/submit_request', methods=['POST'])
@jwt_required()
def submit_request():
    data = request.get_json() or {}
    query_text = (data.get('query') or '').strip()

    if not query_text:
        return jsonify({"error": "Question query text is required"}), 400

    user_identity = get_jwt_identity()

    try:
        from repository.questionrepository import add_question
        from models.question import Status
        from models.document import Langue

        question_rec = add_question(
            date=datetime.utcnow(),
            texte=query_text,
            user=str(user_identity),
            filters="[]",
            langue=Langue.FR,
            status=Status.SENT_TO_EXPERT
        )

        q_dict = question_rec.as_dict() if hasattr(question_rec, 'as_dict') else {"texte": query_text}
        return jsonify({
            "msg": "Demande transmise avec succès au Responsable Juridique",
            "question": q_dict
        }), 201
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"error": "Erreur lors de la soumission de la demande", "details": str(e)}), 500


