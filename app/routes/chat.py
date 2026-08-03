from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.chatbot import ask
from models import Question, db
from datetime import datetime

bp = Blueprint('chat', __name__, url_prefix='/chat')

@bp.route('/ask', methods=['POST'])
@jwt_required()
def ask_question():
    user_id = str(get_jwt_identity())
    data = request.get_json()
    question_text = data.get('question')

    if not question_text:
        return jsonify({'error': 'Missing question'}), 400

    question = Question(
        user_id=user_id,
        content=question_text,
        status='pending'
    )
    db.session.add(question)
    db.session.commit()

    try:
        k = int(data.get("k", 6))  # if k is missing, fallback to 6
        results = ask(question_text, k=k)
        question.status = 'answered'
    except Exception as e:
        results = []
        question.status = 'error'

    question.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        "question": {
            "id": question.id,
            "user_id": question.user_id,
            "content": question.content,
            "date": question.date.isoformat(),
            "status": question.status,
            "updated_at": question.updated_at.isoformat()
        },
        "results": results
    }), 200
