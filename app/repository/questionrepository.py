from datetime import datetime, timedelta

from models.question import Question
from utils.extensions import db

# Fenêtre de déduplication : deux questions identiques (même utilisateur,
# même texte, même statut) créées à moins de DEDUP_WINDOW_SECONDS d'intervalle
# sont considérées comme un seul et même enregistrement.
DEDUP_WINDOW_SECONDS = 120


def get_questions_with_feedback(page=1, per_page=10):
    pagination = Question.query.filter(Question.feedback.any()).paginate(page=page, per_page=per_page, error_out=False)
    questions_with_feedback = pagination.items
    total_questions = pagination.total
    total_pages = pagination.pages
    return {
        'questions': [question.as_dict() for question in questions_with_feedback],
        'total_questions': total_questions,
        'total_pages': total_pages,
        'current_page': page
    }

def delete_question(question_id):
    question = Question.query.get(question_id)
    if question:
        db.session.delete(question)
        db.session.commit()
        return True
    return False


def get_all_questions():
    questions = Question.query.all()
    return [question.as_dict() for question in questions]

def get_question_by_id(question_id):
    question = Question.query.get(question_id)
    return question.as_dict() if question else None


def update_question(question_id, date=None, texte=None):
    question = Question.query.get(question_id)
    if question:
        if date:
            question.date = date
        if texte:
            question.texte = texte
        db.session.commit()
        return question.as_dict()
    return None


def find_recent_identical_question(texte, user, status, reference_date=None,
                                   window_seconds=DEDUP_WINDOW_SECONDS):
    """
    Retourne la question identique la plus récente créée dans la fenêtre de
    déduplication, ou None.

    La langue est volontairement exclue de la clé de comparaison : les
    endpoints envoient 'fr' en minuscules alors que la colonne est un enum
    FR/ENG/AR, la valeur n'est donc pas fiable.
    """
    if not texte or user is None:
        return None

    reference_date = reference_date or datetime.utcnow()
    if not isinstance(reference_date, datetime):
        # Date fournie sous forme de chaîne (endpoint /create) : on ne
        # déduplique pas plutôt que de risquer une comparaison erronée.
        return None

    since = reference_date - timedelta(seconds=window_seconds)

    return (
        Question.query
        .filter(
            Question.user == str(user),
            Question.texte == texte,
            Question.status == status,
            Question.date >= since,
            Question.date <= reference_date,
        )
        .order_by(Question.date.desc())
        .first()
    )


def add_question(date, texte, user, filters, langue, status=None):
    from models.question import Status
    if status is None:
        status = Status.NORMAL

    if date is None:
        date = datetime.utcnow()

    # Anti-doublon : si la même question vient d'être enregistrée pour cet
    # utilisateur, on réutilise l'enregistrement existant au lieu d'en créer
    # un nouveau. Protège contre les double-clics et contre la cascade
    # d'appels /recherche_simple -> /grouped_search -> /recherche_interpretation.
    existing = find_recent_identical_question(texte, user, status, date)
    if existing is not None:
        return existing

    new_question = Question(date, texte, user, filters, langue, status)
    db.session.add(new_question)
    db.session.commit()
    return new_question