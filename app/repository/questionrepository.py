from models.question import Question
from utils.extensions import db

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


def add_question(date, texte, user, filters, langue, status=None):
    from models.question import Status
    if status is None:
        status = Status.NORMAL
    new_question = Question(date, texte, user, filters, langue, status)
    db.session.add(new_question)
    db.session.commit()
    return new_question

