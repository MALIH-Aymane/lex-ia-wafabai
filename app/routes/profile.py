from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User

bp = Blueprint('profile', __name__, url_prefix='/profile')

@bp.route('/', methods=['GET'])
@jwt_required()
def profile():
    user = User.query.get(get_jwt_identity())
    return jsonify(
        username=user.username,
        name=f"{user.first_name} {user.last_name}",
        roles=[r.name for r in user.roles]
    )
