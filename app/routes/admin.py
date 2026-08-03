from flask import Blueprint, jsonify
from models import User
from decorators import roles_required

bp = Blueprint('admin', __name__, url_prefix='/admin')

@bp.route('/users', methods=['GET'])
@roles_required('admin')
def all_users():
    users = User.query.all()
    return jsonify([
        {"id": u.id, "username": u.username, "roles": [r.name for r in u.roles]}
        for u in users
    ])
