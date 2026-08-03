import os
import time
from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from service.userservice import UserService
from service.roleservice import RoleService
from models.user import User
from models.role import Role
from utils.extensions import db


user_ws = Blueprint('user_ws', __name__)
AVATAR_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'avatars')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'}



@user_ws.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    role_name = request.args.get('role')  # e.g., /users?role=admin

    query = User.query

    if role_name:
        query = query.join(Role).filter(Role.name == role_name)

    users = query.all()
    return jsonify([user.to_dict() for user in users]), 200



@user_ws.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    try:
        user = UserService.get_user_by_id(user_id)
        return jsonify({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role.name,
            'is_blocked': user.is_blocked
        }), 200
    except ValueError as e:
        return jsonify({'msg': str(e)}), 404

@user_ws.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    firstname = data.get('firstname')
    lastname = data.get('lastname')
    role_name = data.get('role', None)
    if role_name == None:
        role_name = 'user'
    role = RoleService.get_role_by_name(role_name)
    is_blocked = data.get('is_blocked', False)
    must_change_password = data.get('must_change_password', False)

    try:
        new_user = UserService.create_user(
            username=username,
            email=email,
            password=password,
            firstname=firstname,
            lastname=lastname,
            role_id=role.id,
            is_blocked=is_blocked,
            must_change_password=must_change_password
        )
        return jsonify({
            'id': new_user.id,
            'username': new_user.username,
            'email': new_user.email,
            'role': new_user.role.name
        }), 201
    except ValueError as e:
        return jsonify({'msg': str(e)}), 400

@user_ws.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password',None)
    firstname = data.get('firstname')
    lastname = data.get('lastname')
    role_name = data.get('role', None)
    if role_name == None:
        role_name = 'user'
    role = RoleService.get_role_by_name(role_name)
    is_blocked = data.get('is_blocked', False)
    must_change_password = data.get('must_change_password', False)
    print(role)
    try:
        updated_user = UserService.update_user(
            username=username,
            user_id=user_id,
            email=email,
            password=password,
            firstname=firstname,
            lastname=lastname,
            role_id=role.id,
            is_blocked=is_blocked,
            must_change_password=must_change_password
        )
        return jsonify({
            'id': updated_user.id,
            'username': updated_user.username,
            'email': updated_user.email,
            'role': updated_user.role.name
        }), 200
    except ValueError as e:
        return jsonify({'msg': str(e)}), 400


@user_ws.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    try:
        UserService.delete_user(user_id)
        return jsonify({'msg': 'User deleted successfully'}), 200
    except ValueError as e:
        return jsonify({'msg': str(e)}), 404


# ---------------------------------------------------------------------------
# 📸 User Avatar Upload & Serve Routes
# ---------------------------------------------------------------------------
@user_ws.route('/upload_avatar', methods=['POST', 'OPTIONS'])
def upload_avatar():
    """
    Upload a user profile avatar image.
    """
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    return _do_upload_avatar()

@jwt_required()
def _do_upload_avatar():
    current_user_id = get_jwt_identity()

    if 'file' not in request.files and 'avatar' not in request.files:
        return jsonify({'msg': 'Aucun fichier image trouvé dans la requête.'}), 400

    file = request.files.get('file') or request.files.get('avatar')
    if not file or not file.filename:
        return jsonify({'msg': 'Fichier invalide ou vide.'}), 400

    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({'msg': f'Extension .{ext} non autorisée. Formats acceptés : png, jpg, jpeg, webp, gif, svg.'}), 400

    os.makedirs(AVATAR_FOLDER, exist_ok=True)

    filename = f"avatar_user_{current_user_id}_{int(time.time())}.{ext}"
    filepath = os.path.join(AVATAR_FOLDER, filename)
    file.save(filepath)

    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'msg': 'Utilisateur non trouvé.'}), 404

    user.avatar = filename
    db.session.commit()

    return jsonify({
        'msg': 'Photo de profil mise à jour avec succès !',
        'avatar': filename,
        'user': user.to_dict()
    }), 200


@user_ws.route('/avatars/<path:filename>', methods=['GET'])
def get_avatar(filename):
    """
    Serve uploaded user avatar images.
    """
    os.makedirs(AVATAR_FOLDER, exist_ok=True)
    return send_from_directory(AVATAR_FOLDER, filename)



