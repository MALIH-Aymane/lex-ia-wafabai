from flask import Blueprint, jsonify, request
from datetime import datetime, date, timedelta
from sqlalchemy import func
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


# =====================================================================
# Donnees agregees pour les graphiques du tableau de bord
# =====================================================================

# Libelles lisibles pour les statuts de question
STATUS_LABELS = {
    Status.NORMAL: "Recherches simples",
    Status.SENT_TO_EXPERT: "Transmises a l'expert",
    Status.JURISPRUDENCE: "Jurisprudences",
}


def _questions_par_jour(nb_jours):
    """Serie temporelle : nombre de questions par jour sur la periode."""
    debut = date.today() - timedelta(days=nb_jours - 1)

    lignes = (
        db.session.query(
            func.date(Question.date).label('jour'),
            func.count(Question.id).label('nb')
        )
        .filter(Question.date >= datetime(debut.year, debut.month, debut.day))
        .group_by(func.date(Question.date))
        .all()
    )

    # Index des resultats pour combler les jours sans activite
    par_jour = {}
    for jour, nb in lignes:
        if isinstance(jour, str):
            jour = datetime.strptime(jour, '%Y-%m-%d').date()
        par_jour[jour] = nb

    labels, valeurs = [], []
    for i in range(nb_jours):
        j = debut + timedelta(days=i)
        labels.append(j.strftime('%d/%m'))
        valeurs.append(par_jour.get(j, 0))

    return {"labels": labels, "data": valeurs}


def _questions_par_statut():
    """Repartition des questions par statut."""
    lignes = (
        db.session.query(Question.status, func.count(Question.id))
        .group_by(Question.status)
        .all()
    )

    labels, valeurs = [], []
    for statut, nb in lignes:
        labels.append(STATUS_LABELS.get(statut, str(statut)))
        valeurs.append(nb)

    return {"labels": labels, "data": valeurs}


def _top_utilisateurs(limite):
    """Utilisateurs les plus actifs, avec resolution du nom depuis l'id."""
    lignes = (
        db.session.query(Question.user, func.count(Question.id).label('nb'))
        .group_by(Question.user)
        .order_by(func.count(Question.id).desc())
        .limit(limite)
        .all()
    )

    # La colonne questions.user contient l'id utilisateur sous forme de chaine
    noms = {}
    for u in User.query.all():
        noms[str(u.id)] = u.username

    labels, valeurs = [], []
    for identifiant, nb in lignes:
        if identifiant is None:
            continue
        labels.append(noms.get(str(identifiant), "Utilisateur %s" % identifiant))
        valeurs.append(nb)

    return {"labels": labels, "data": valeurs}


def _documents_par_collection():
    """Repartition des documents visibles par collection vectorielle."""
    lignes = (
        db.session.query(Document.collection_name, func.count(Document.id))
        .filter(Document.ishidden == False)  # noqa: E712
        .group_by(Document.collection_name)
        .order_by(func.count(Document.id).desc())
        .all()
    )

    labels, valeurs = [], []
    for collection, nb in lignes:
        labels.append(collection if collection else "Non classes")
        valeurs.append(nb)

    return {"labels": labels, "data": valeurs}


def _documents_par_langue():
    """Repartition des documents visibles par langue."""
    lignes = (
        db.session.query(Document.langue, func.count(Document.id))
        .filter(Document.ishidden == False)  # noqa: E712
        .group_by(Document.langue)
        .all()
    )

    labels, valeurs = [], []
    for langue, nb in lignes:
        labels.append(langue.value.upper() if hasattr(langue, 'value') else str(langue))
        valeurs.append(nb)

    return {"labels": labels, "data": valeurs}


@dashboard_ws.route("/charts", methods=["GET"])
def get_dashboard_charts():
    """
    Donnees agregees pretes a etre injectees dans Chart.js.

    Parametres optionnels :
      - jours : profondeur de la serie temporelle (defaut 30, max 365)
      - top   : nombre d'utilisateurs dans le classement (defaut 5, max 20)

    Chaque bloc renvoie { "labels": [...], "data": [...] }.
    """
    try:
        nb_jours = min(max(request.args.get('jours', 30, type=int), 1), 365)
        limite = min(max(request.args.get('top', 5, type=int), 1), 20)

        return jsonify({
            "questions_par_jour": _questions_par_jour(nb_jours),
            "questions_par_statut": _questions_par_statut(),
            "top_utilisateurs": _top_utilisateurs(limite),
            "documents_par_collection": _documents_par_collection(),
            "documents_par_langue": _documents_par_langue(),
            "periode_jours": nb_jours,
            "server_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500