# user_service.py
from repository.questionrepository import get_questions_with_feedback, add_question, get_all_questions, get_question_by_id, update_question, delete_question
from flask import Blueprint, jsonify, request
from utils.extensions import db
from models.question import Question, Status
question_ws = Blueprint('questions', __name__)
from flask_jwt_extended import jwt_required, get_jwt_identity


@question_ws.route('/create', methods=['POST'])
def create_question():
    data = request.get_json()
    date = data.get('date')
    texte = data.get('texte')
    user = data.get('user')
    filters = data.get('filters')
    langue = data.get('langue')
    
    if not date or not texte:
        return jsonify({'error': 'Missing data'}), 400
    question = add_question(date, texte, user, filters, document_id, model_id, langue)
    return jsonify(question), 201

@question_ws.route('/question-with-feedback', methods=['GET'])
def get_questions_with_feedback_route():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    print(page, per_page)

    questions = get_questions_with_feedback(page, per_page)
    return jsonify(questions), 200

@question_ws.route('/questions', methods=['GET'])
def read_all_questions():
    questions = get_all_questions()
    return jsonify(questions), 200

@question_ws.route('/question/<int:question_id>', methods=['GET'])
def read_question(question_id):
    question = get_question_by_id(question_id)
    if question:
        return jsonify(question), 200
    else:
        return jsonify({'error': 'Question not found'}), 404


@question_ws.route('/questions/by-document/<int:document_id>/<username>', methods=['GET'])
def get_questions_by_document(document_id, username):
    try:
        questions = Question.query.filter_by(document_id=document_id, user=username).all()
        if not questions:
            return jsonify({'message': 'No questions found for this document and user.'}), 404

        return jsonify([question.as_dict() for question in questions]), 200
    except Exception as e:
        return jsonify({'message': 'An error occurred while fetching questions.', 'error': str(e)}), 500

@question_ws.route('/question/<int:question_id>', methods=['PUT'])
def update_question_route(question_id):
    data = request.get_json()
    date = data.get('date')
    texte = data.get('texte')
    updated_question = update_question(question_id, date, texte)
    if updated_question:
        return jsonify(updated_question), 200
    else:
        return jsonify({'error': 'Question not found or update failed'}), 404

@question_ws.route('/question/<int:question_id>', methods=['DELETE'])
def delete_question_route(question_id):
    success = delete_question(question_id)
    if success:
        return jsonify({'success': 'Question deleted'}), 204
    else:
        return jsonify({'error': 'Question not found'}), 404

@question_ws.route('/users/questions', methods=['GET'])
@jwt_required
def read_all_user_questions():
    questions = Question.query.filter_by(user=username).all()
    return jsonify([question.as_dict() for question in questions]), 200


@question_ws.route('/users/questions/pagination', methods=['GET'])
@jwt_required()
def read_all_user_questions_pagination():
    # Get pagination parameters from the query string

    user = get_jwt_identity()

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    # Query the database with pagination
    pagination = Question.query.filter_by(user=user).order_by(Question.date.desc()).paginate(page=page, per_page=per_page, error_out=False)

    # Get the items and total number of items
    questions = pagination.items
    total_items = pagination.total

    # Create a response dictionary
    response = {
        'questions': [question.as_dict() for question in questions],
        'total_items': total_items,
        'page': page,
        'per_page': per_page,
        'total_pages': pagination.pages
    }

    return jsonify(response), 200



# ========================= 1) GET SENT_TO_EXPERT ==============================
@question_ws.route('/questions/status/sent-to-expert', methods=['GET'])
def get_questions_sent_to_expert():
    """
    Return all questions with status = SENT_TO_EXPERT.
    Optional query params: page, per_page.
    """
    page = request.args.get('page', type=int)
    per_page = request.args.get('per_page', type=int)

    base = Question.query.filter(Question.status == Status.SENT_TO_EXPERT)
    if page and per_page:
        pag = base.order_by(Question.date.desc()).paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({
            "questions": [q.as_dict() for q in pag.items],
            "total_items": pag.total, "page": page, "per_page": per_page, "total_pages": pag.pages
        }), 200

    qs = base.order_by(Question.date.desc()).all()
    return jsonify([q.as_dict() for q in qs]), 200



# ==================== 2) GET BY USER & (OPTIONAL) STATUS ====================
@question_ws.route('/questions/by-user-status', methods=['GET'])
def get_questions_by_user_and_status():
    """
    Query params:
      - user   : <username> (required)
      - status : OPTIONAL. One or many (comma-separated).
                 Accepts enum names or values, case-insensitive:
                 NORMAL | SENT_TO_EXPERT | JURISPRUDENCE
                 or "Normal", "Sent to expert", "Jurisprudence"
      - page, per_page : OPTIONAL pagination
    """
    user = request.args.get('user')
    if not user:
        return jsonify({"error": "Missing 'user' query param"}), 400

    status_param = request.args.get('status')
    page = request.args.get('page', type=int)
    per_page = request.args.get('per_page', type=int)

    base = Question.query.filter(Question.user == user)

    # If status provided, resolve to enum members (supports names or values)
    if status_param:
        raw_parts = [s.strip() for s in status_param.split(',') if s.strip()]
        resolved, invalid = [], []

        for part in raw_parts:
            key = part.upper().replace(" ", "_")
            # try enum NAME
            member = getattr(Status, key, None)
            if member is None:
                # try enum VALUE (human-readable), case-insensitive
                member = next((m for m in Status if m.value.lower() == part.lower()), None)
            if member is None:
                invalid.append(part)
            else:
                resolved.append(member)

        if invalid:
            return jsonify({
                "error": "Invalid status value(s). Use NORMAL | SENT_TO_EXPERT | JURISPRUDENCE",
                "invalid": invalid
            }), 400

        if resolved:  # filter only if at least one valid status was provided
            base = base.filter(Question.status.in_(resolved))

    base = base.order_by(Question.date.desc())

    if page and per_page:
        pag = base.paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({
            "questions": [q.as_dict() for q in pag.items],
            "total_items": pag.total,
            "page": page,
            "per_page": per_page,
            "total_pages": pag.pages
        }), 200

    qs = base.all()
    return jsonify([q.as_dict() for q in qs]), 200


# ======= 3) GET (IDENTIFIED USER) BY STATUS (single or comma-separated) =======
@question_ws.route('/users/questions/by-status', methods=['GET'])
@jwt_required()
def get_identified_user_questions_by_status():
    """
    Current JWT user + status filter.
    Query params:
      - status: one of NORMAL|SENT_TO_EXPERT|JURISPRUDENCE
                or comma-separated (e.g., SENT_TO_EXPERT,JURISPRUDENCE)
      - page, per_page: optional pagination
    """
    user = get_jwt_identity()
    status_param = request.args.get('status')
    if not status_param:
        return jsonify({"error": "Missing 'status' query param"}), 400

    # Support single or comma-separated statuses; case-insensitive
    raw_parts = [s.strip() for s in status_param.split(',') if s.strip()]
    resolved_statuses = []
    invalid = []

    for part in raw_parts:
        key = part.upper().replace(" ", "_")
        try:
            resolved_statuses.append(Status[key])  # matches enum *names*
        except KeyError:
            invalid.append(part)

    if invalid:
        return jsonify({
            "error": "Invalid status value(s). Use NORMAL | SENT_TO_EXPERT | JURISPRUDENCE",
            "invalid": invalid
        }), 400

    page = request.args.get('page', type=int)
    per_page = request.args.get('per_page', type=int)

    base = Question.query.filter(Question.user == user, Question.status.in_(resolved_statuses))
    base = base.order_by(Question.date.desc())

    if page and per_page:
        pag = base.paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({
            "questions": [q.as_dict() for q in pag.items],
            "total_items": pag.total,
            "page": page,
            "per_page": per_page,
            "total_pages": pag.pages
        }), 200

    qs = base.all()
    return jsonify([q.as_dict() for q in qs]), 200



from flask import jsonify
from flask_jwt_extended import jwt_required
from datetime import datetime
from models.question import Question  # adapt import to your structure
from utils.extensions import db   # your SQLAlchemy instance


@question_ws.route("/questions/<int:question_id>/send-to-expert", methods=["POST"])
@jwt_required()
def send_question_to_expert(question_id):
    """
    Set the status of a Question to SEND_TO_EXPERT.
    """
    question = Question.query.get(question_id)
    if not question:
        return jsonify({"error": f"Question {question_id} not found"}), 404

    try:
        question.status = "SENT_TO_EXPERT"
        # if you have timestamps
        if hasattr(question, "updated_at"):
            question.updated_at = datetime.utcnow()

        db.session.commit()
        return jsonify(question.as_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to update status", "details": str(e)}), 500
