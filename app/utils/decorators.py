# utils/decorators.py
#
# Décorateurs d'autorisation basés sur le rôle de l'utilisateur courant.
#
# Usage :
#   @recherche_ws.route('/mon_endpoint', methods=['POST'])
#   @role_required('Administrateur', 'Responsable juridique')
#   def mon_endpoint():
#       ...
#
# role_required() appelle verify_jwt_in_request() en interne :
# il REMPLACE @jwt_required(), on ne cumule pas les deux.

from functools import wraps

from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from models.user import User


def get_current_user():
    """Retourne l'objet User correspondant à l'identité du JWT, ou None."""
    identity = get_jwt_identity()
    if identity is None:
        return None

    # L'identité stockée dans le token est l'id utilisateur (cf. questions.user).
    # On gère aussi le cas où ce serait un username, par sécurité.
    if str(identity).isdigit():
        return User.query.get(int(identity))
    return User.query.filter_by(username=str(identity)).first()


def get_current_role_name():
    """Retourne le nom du rôle de l'utilisateur courant, ou None."""
    user = get_current_user()
    if user is None:
        return None
    role = getattr(user, 'role', None)
    return role.name if role is not None else None


def role_required(*allowed_roles):
    """Refuse l'accès (403) si le rôle de l'utilisateur n'est pas autorisé."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()

            user = get_current_user()
            if user is None:
                return jsonify({'error': 'Utilisateur introuvable'}), 401

            role = getattr(user, 'role', None)
            role_name = role.name if role is not None else None

            if role_name not in allowed_roles:
                return jsonify({
                    'error': "Accès refusé : cette fonctionnalité n'est pas "
                             "disponible pour votre rôle."
                }), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator