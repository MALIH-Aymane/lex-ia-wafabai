# app/routes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt, create_refresh_token
from models.user import User
from models.role import Role
from models.revoked_token import TokenBlocklist
from flask_bcrypt import Bcrypt
from utils.extensions import db
from service.userservice import UserService
from models.otp import PasswordResetOTP
from utils.email_utils import send_otp_email

authws = Blueprint('auth', __name__)
bcrypt = Bcrypt()

@authws.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    must_change_password = data.get('must_change_password')
    role_name = data.get('role', 'user')
    print(role_name)
    role = Role.query.filter_by(name=role_name).first()
    if not role:
        return jsonify({'msg': 'Role does not exist'}), 400

    user = User(username=username, role=role)
    user.email = email
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({'msg': 'User created'}), 201

@authws.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()
    if user and user.verify_password(password):
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))
        return jsonify(token=access_token, refresh_token=refresh_token, user=user.to_dict()), 200
    return jsonify({'msg': 'Invalid credentials'}), 401


@authws.route('/current_user', methods=['GET'])
@jwt_required()
def get_current_user():
    # Get the user ID or identity from the token
    current_user = get_jwt_identity()
    print("current user =======> ", current_user)

    # Query the database to get the user object
    current_user = User.query.get(current_user)

    if current_user:
        return jsonify(current_user.to_dict()), 200
    else:
        return jsonify({'msg': 'User not found'}), 404


@authws.route('/update_profile', methods=['PUT'])
@jwt_required()
def update_profile():
    # get_jwt_identity() returns the plain user ID string (set via identity=str(user.id) at login)
    current_user_id = int(get_jwt_identity())

    # Get the updated profile details from the request body
    data = request.get_json()
    if not data:
        return jsonify({'msg': 'No data provided'}), 400

    username = data.get('username', None)
    firstname = data.get('firstname', None)
    lastname = data.get('lastname', None)
    email = data.get('email', None)

    # Perform the profile update
    try:
        print(current_user_id, username, firstname, lastname, email)
        updated_user = UserService.update_profile(current_user_id, username, firstname, lastname, email)
        return jsonify(updated_user.to_dict()), 200
    except ValueError as e:
        return jsonify({'msg': str(e)}), 400

@authws.route('/change_password', methods=['POST'])
@jwt_required()
def change_password():
    # Get the user ID from the JWT token
    current_user_id = get_jwt_identity()

    # Get the current and new passwords from the request body
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    # Perform the password change
    try:
        UserService.change_password(current_user_id, current_password, new_password)
        return jsonify({'msg': 'Password changed successfully'}), 200
    except ValueError as e:
        return jsonify({'msg': str(e)}), 400


@authws.route('/refresh_token', methods=['POST'])
@jwt_required(refresh=True)  # Assurez-vous que le refresh token est utilisé
def refresh():
    current_user_id = get_jwt_identity()
    new_access_token = create_access_token(identity=str(current_user_id))  # Générer un nouveau access token
    return jsonify(access_token=new_access_token), 200


@authws.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """
    Invalidate the current access token by adding its JTI to the blocklist.
    """
    jti = get_jwt()["jti"]
    db.session.add(TokenBlocklist(jti=jti))
    db.session.commit()
    return jsonify(msg="Successfully logged out."), 200


# ---------------------------------------------------------------------------
# 🔐 Forgot Password & OTP Routes
# ---------------------------------------------------------------------------
@authws.route('/forgot_password', methods=['POST'])
def forgot_password():
    """
    Step 1: User enters email or username -> Generate OTP and send via SMTP email.
    """
    data = request.get_json() or {}
    identifier = (data.get('email') or data.get('username') or '').strip()

    if not identifier:
        return jsonify({'msg': 'Veuillez saisir votre adresse e-mail ou nom d\'utilisateur.'}), 400

    # Search by email or username
    user = User.query.filter(
        (User.email.ilike(identifier)) | (User.username.ilike(identifier))
    ).first()

    if not user:
        return jsonify({'msg': 'Aucun compte associé à cette adresse e-mail ou identifiant.'}), 444 if False else 404

    target_email = user.email

    try:
        # Generate 6-digit OTP code valid for 15 minutes
        otp_code = PasswordResetOTP.generate_otp(target_email)

        # Send styled HTML email via SMTP
        send_otp_email(target_email, otp_code)

        # Mask email for UI output (e.g. a***e@domain.com)
        parts = target_email.split('@')
        masked = parts[0][0] + '***' + (parts[0][-1] if len(parts[0]) > 1 else '') + '@' + parts[1]

        return jsonify({
            'msg': f'Un code OTP a été envoyé à {masked}.',
            'email': target_email
        }), 200
    except Exception as e:
        print("[ERROR] SMTP Send Error:", e)
        return jsonify({'msg': f'Erreur d\'envoi de l\'e-mail : {str(e)}'}), 500


@authws.route('/verify_otp', methods=['POST'])
def verify_otp():
    """
    Step 2: Verify the 6-digit OTP code entered by the user.
    """
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    otp = (data.get('otp') or '').strip()

    if not email or not otp:
        return jsonify({'msg': 'Adresse e-mail et code OTP requis.'}), 400

    is_valid, message = PasswordResetOTP.validate_otp(email, otp)
    if not is_valid:
        return jsonify({'msg': message}), 400

    return jsonify({'valid': True, 'msg': message}), 200


@authws.route('/reset_password_otp', methods=['POST'])
def reset_password_otp():
    """
    Step 3: Reset password using verified OTP code.
    """
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    otp = (data.get('otp') or '').strip()
    new_password = data.get('new_password') or ''

    if not email or not otp or not new_password:
        return jsonify({'msg': 'E-mail, code OTP et nouveau mot de passe requis.'}), 400

    if len(new_password) < 4:
        return jsonify({'msg': 'Le nouveau mot de passe doit contenir au moins 4 caractères.'}), 400

    # Re-validate OTP
    is_valid, message = PasswordResetOTP.validate_otp(email, otp)
    if not is_valid:
        return jsonify({'msg': message}), 400

    # Find user and update password
    user = User.query.filter(User.email.ilike(email)).first()
    if not user:
        return jsonify({'msg': 'Utilisateur introuvable.'}), 404

    user.set_password(new_password)
    user.must_change_password = False
    PasswordResetOTP.clear_otp(email)
    db.session.commit()

    return jsonify({'msg': 'Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter.'}), 200

