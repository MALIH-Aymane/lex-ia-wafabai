from flask import Blueprint, jsonify, request
from utils.extensions import db
from models.llm_model import LLMModel
import traceback

llm_model_ws = Blueprint("llm_model_ws", __name__)

# -------------------------------------------------------------
# 1️⃣ Get all models
# -------------------------------------------------------------
@llm_model_ws.route("/llm-models", methods=["GET"])
def get_all_models():
    try:
        models = LLMModel.query.order_by(LLMModel.name.asc()).all()
        return jsonify([m.as_dict() for m in models]), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------
# 2️⃣ Create a new model
# -------------------------------------------------------------
@llm_model_ws.route("/llm-models", methods=["POST"])
def create_model():
    try:
        data = request.get_json()
        if not data.get("name") or not data.get("provider"):
            return jsonify({"error": "Missing 'name' or 'provider' field"}), 400

        is_default = bool(data.get("is_default", False))
        
        # If no default model exists currently, make this one default automatically
        existing_default = LLMModel.query.filter_by(is_default=True).first()
        if not existing_default:
            is_default = True

        if is_default:
            LLMModel.query.update({LLMModel.is_default: False})

        model = LLMModel(
            name=data["name"],
            provider=data["provider"],
            endpoint=data.get("endpoint"),
            api_key=data.get("api_key"),
            temperature=data.get("temperature", 0.7),
            max_tokens=data.get("max_tokens", 2048),
            is_active=data.get("is_active", True),
            is_default=is_default
        )

        db.session.add(model)
        db.session.commit()

        return jsonify({"message": "LLM model created successfully", "model": model.as_dict()}), 201

    except Exception as e:
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------
# 3️⃣ Get a single model
# -------------------------------------------------------------
@llm_model_ws.route("/llm-models/<int:model_id>", methods=["GET"])
def get_model(model_id):
    try:
        model = LLMModel.query.get_or_404(model_id)
        return jsonify(model.as_dict()), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------
# 4️⃣ Update an existing model
# -------------------------------------------------------------
@llm_model_ws.route("/llm-models/<int:model_id>", methods=["PUT"])
def update_model(model_id):
    try:
        model = LLMModel.query.get_or_404(model_id)
        data = request.get_json()

        if "is_default" in data and data["is_default"]:
            LLMModel.query.filter(LLMModel.id != model_id).update({LLMModel.is_default: False})
            model.is_default = True

        model.name = data.get("name", model.name)
        model.provider = data.get("provider", model.provider)
        model.endpoint = data.get("endpoint", model.endpoint)
        model.api_key = data.get("api_key", model.api_key)
        model.temperature = data.get("temperature", model.temperature)
        model.max_tokens = data.get("max_tokens", model.max_tokens)
        model.is_active = data.get("is_active", model.is_active)

        db.session.commit()
        return jsonify({"message": "Model updated successfully", "model": model.as_dict()}), 200

    except Exception as e:
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------
# 5️⃣ Delete (soft remove) model
# -------------------------------------------------------------
@llm_model_ws.route("/llm-models/<int:model_id>", methods=["DELETE"])
def delete_model(model_id):
    try:
        model = LLMModel.query.get_or_404(model_id)
        was_default = model.is_default

        db.session.delete(model)
        db.session.commit()

        if was_default:
            next_model = LLMModel.query.filter_by(is_active=True).first()
            if next_model:
                next_model.is_default = True
                db.session.commit()

        return jsonify({"message": f"Model '{model.name}' deleted successfully"}), 200
    except Exception as e:
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------
# 6️⃣ Toggle model activation (active/inactive)
# -------------------------------------------------------------
@llm_model_ws.route("/llm-models/<int:model_id>/toggle", methods=["PATCH", "PUT"])
def toggle_model(model_id):
    try:
        model = LLMModel.query.get_or_404(model_id)
        model.is_active = not model.is_active
        db.session.commit()

        status = "activated" if model.is_active else "deactivated"
        return jsonify({
            "message": f"Model '{model.name}' has been {status}.",
            "model": model.as_dict()
        }), 200

    except Exception as e:
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------
# 6️⃣b Set model as default
# -------------------------------------------------------------
@llm_model_ws.route("/llm-models/<int:model_id>/default", methods=["PATCH", "PUT"])
def set_default_model(model_id):
    try:
        model = LLMModel.query.get_or_404(model_id)
        LLMModel.query.update({LLMModel.is_default: False})
        model.is_default = True
        model.is_active = True  # Default model should also be active
        db.session.commit()

        return jsonify({
            "message": f"Model '{model.name}' is now set as the default model.",
            "model": model.as_dict()
        }), 200

    except Exception as e:
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------
# 7️⃣ Get only active models
# -------------------------------------------------------------
@llm_model_ws.route("/llm-models/active", methods=["GET"])
def get_active_models():
    try:
        models = LLMModel.query.filter_by(is_active=True).order_by(LLMModel.name.asc()).all()
        return jsonify([m.as_dict() for m in models]), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------
# 8️⃣ Test a model's connectivity
# -------------------------------------------------------------
@llm_model_ws.route("/llm-models/<int:model_id>/test", methods=["POST"])
def test_model(model_id):
    try:
        from datetime import datetime
        model = LLMModel.query.get_or_404(model_id)
        from llm_utils.llm_router import LLMRouter
        llm_router = LLMRouter()
        
        test_prompt = "Say 'LEX-IA OK' in exactly 3 words."
        
        start_time = datetime.now()
        answer = llm_router.generate(model.name, test_prompt)
        duration = (datetime.now() - start_time).total_seconds()
        
        return jsonify({
            "status": "success",
            "message": "Connexion réussie !",
            "response": answer.strip(),
            "time_taken_seconds": round(duration, 2)
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": f"Échec de la connexion : {str(e)}"
        }), 200
