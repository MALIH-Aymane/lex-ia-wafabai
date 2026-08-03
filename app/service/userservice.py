# services/user_service.py
from repository.userdao import UserDAO
from repository.roledao import RoleDAO
from models.user import User


class UserService:
    @staticmethod
    def get_all_users():
        return UserDAO.get_all_users()

    @staticmethod
    def get_user_by_id(user_id):
        return UserDAO.get_user_by_id(user_id)

    @staticmethod
    def get_user_by_username(username):
        return UserDAO.get_user_by_username(username)

    @staticmethod
    def get_user_by_email(email):
        return UserDAO.get_user_by_email(email)

    @staticmethod
    def create_user(username, email, password,firstname, lastname, role_id, is_blocked=False, must_change_password=False):
        if UserDAO.get_user_by_username(username):
            raise ValueError("Username already exists")
        if UserDAO.get_user_by_email(email):
            raise ValueError("Email already exists")
        if not username or not isinstance(username, str) or len(username) < 3:
            raise ValueError("Invalid username")
        if not email or '@' not in email:
            raise ValueError("Invalid email")
        if not password or len(password) < 6:
            raise ValueError("Invalid password")

        role = RoleDAO.get_role_by_id(role_id)
        if not role:
            raise ValueError("Invalid role ID")

        return UserDAO.create_user(username, email, password,firstname, lastname, role, is_blocked, must_change_password)

    @staticmethod
    def update_user(user_id, username, email, password,firstname, lastname, role_id, is_blocked=False, must_change_password=False):
        user = UserDAO.get_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        if UserDAO.get_user_by_username(username) and UserDAO.get_user_by_username(username).id != user_id:
            raise ValueError("Another user with this username already exists")
        if UserDAO.get_user_by_email(email) and UserDAO.get_user_by_email(email).id != user_id:
            raise ValueError("Another user with this email already exists")
        if not username or not isinstance(username, str) or len(username) < 3:
            raise ValueError("Invalid username")
        if not email or '@' not in email:
            raise ValueError("Invalid email")

        role = RoleDAO.get_role_by_id(role_id)
        if not role:
            raise ValueError("Invalid role ID")

        return UserDAO.update_user(user, username, email, password,firstname, lastname, role, is_blocked, must_change_password)

    @staticmethod
    def delete_user(user_id):
        user = UserDAO.get_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")

        UserDAO.delete_user(user)
        return user

    @staticmethod
    def change_password(user_id, current_password, new_password):
        # Retrieve the user by their ID
        user = UserService.get_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")

        # Verify the current password
        if not user.verify_password(current_password):
            raise ValueError("Current password is incorrect")

        # Validate the new password (ensure it's long enough, etc.)
        if len(new_password) < 6:
            raise ValueError("New password must be at least 6 characters long")

        # Update the password
        return UserDAO.update_user_password(user, new_password)


    @staticmethod
    def update_profile(user_id, username, firstname, lastname, email):
        # Fetch the user by ID
        user = UserDAO.get_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")

        # Check if email is already taken by another user
        existing_user = User.query.filter_by(email=email).first()
        if existing_user and existing_user.id != user_id:
            raise ValueError("This email is already in use")

        # Update user profile in the DAO
        return UserDAO.update_user_profile(user, username, firstname, lastname, email)