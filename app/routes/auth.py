from flask import Blueprint, request, jsonify
from models import db, User, Role
from flask_bcrypt import generate_password_hash
from app import db, bcrypt
from flask_jwt_extended import create_access_token
from datetime import timedelta
bp = Blueprint('auth', __name__, url_prefix='/auth')

@bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    username = data.get('username')
    password = data.get('password')
    first_name = data.get('first_name')
    last_name = data.get('last_name')

    if not username or not password:
        return jsonify({"error": "Missing username or password"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "User already exists"}), 409

    hashed_password = generate_password_hash(password).decode('utf-8')
    user = User(username=username, password=hashed_password, first_name=first_name, last_name=last_name)

    # ROLE LOGIC
    if username == 'admin@example.com':
        role = Role.query.filter_by(name='admin').first()
    elif username == 'expert@example.com':
        role = Role.query.filter_by(name='expert').first()
    else:
        role = Role.query.filter_by(name='client').first()

    if not role:
        return jsonify({"error": f"Role not found in DB"}), 500

    user.roles.append(role)
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "User registered successfully"}), 201
@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({"error": "Invalid credentials"}), 401

    roles = [role.name for role in user.roles]
    additional_claims = {"roles": roles}
    access_token = create_access_token(identity=str(user.id), additional_claims=additional_claims, expires_delta=timedelta(days=1))
    return jsonify({"access_token": access_token}), 200