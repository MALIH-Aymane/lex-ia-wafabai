from flask import Blueprint, jsonify
from datetime import datetime, date
from models.question import Question, Status
from models.user import User
from models.jurisprudence import Jurisprudence
from models.document import Document
from utils.extensions import db

dashboard_ws = Blueprint("dashboard_ws", __name__)

@dashboard_ws.route("/stats", methods=["GET"])
def get_dashboard_stats():
    try:
        # ----- Today boundaries -----
        today = date.today()
        today_start = datetime(today.year, today.month, today.day)
        today_end = datetime(today.year, today.month, today.day, 23, 59, 59)

        # ----- Questions / Searches -----
        total_questions = Question.query.count()
        questions_today = Question.query.filter(
            Question.date >= today_start,
            Question.date <= today_end
        ).count()

        # ----- Documents -----
        total_documents = Document.query.filter_by(ishidden=False).count()

        # ----- Jurisprudence -----
        total_jurisprudences = Jurisprudence.query.count()

        # ----- Users -----
        total_users = User.query.count()

        # ----- Recent Activity -----
        activity_list = []
        recent_questions = Question.query.order_by(Question.date.desc()).limit(5).all()
        for q in recent_questions:
            activity_list.append({
                'type': 'search',
                'title': f'Recherche : {q.texte}',
                'time': q.date.strftime('%d/%m/%Y à %H:%M') if q.date else 'Récemment'
            })

        recent_docs = Document.query.filter_by(ishidden=False).order_by(Document.id.desc()).limit(3).all()
        for d in recent_docs:
            activity_list.append({
                'type': 'doc',
                'title': f'Document indexé : {d.name}',
                'time': 'Récent'
            })

        return jsonify({
            "questions": {
                "total": total_questions,
                "today": questions_today,
            },
            "documents": {
                "total": total_documents
            },
            "jurisprudences": {
                "total": total_jurisprudences,
            },
            "users": {
                "total": total_users
            },
            "recent_activity": activity_list,
            "server_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
