from models.user import User
from utils.extensions import db

class UserDAO:
    @staticmethod
    def get_all_users():
        return User.query.all()

    @staticmethod
    def get_user_by_id(user_id):
        return User.query.get(user_id)

    @staticmethod
    def get_user_by_username(username):
        return User.query.filter_by(username=username).first()

    @staticmethod
    def get_user_by_email(email):
        return User.query.filter_by(email=email).first()

    @staticmethod
    def create_user(username, email, password, firstname, lastname, role, birthday=None, is_blocked=False, must_change_password=False):
        new_user = User(
            username=username,
            email=email,
            firstname=firstname,
            lastname=lastname,
            role=role,
            must_change_password=must_change_password,
            is_blocked=is_blocked
        )

        if birthday:
            new_user.set_birthday(birthday)

        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()
        return new_user

    @staticmethod
    def update_user(user, username, email, password,firstname, lastname, role, is_blocked, must_change_password):
        user.username = username
        user.email = email
        user.role = role
        user.is_blocked = is_blocked
        user.must_change_password = must_change_password
        if password:
            user.set_password(password)
        user.firstname = firstname
        user.lastname = lastname
        user.role = role

        db.session.commit()
        return user

    @staticmethod
    def delete_user(user):
        db.session.delete(user)
        db.session.commit()


    @staticmethod
    def update_user_password(user, new_password):
        user.set_password(new_password)
        db.session.commit()
        return user

    @staticmethod
    def update_user_profile(user, username, firstname, lastname, email):
        if username:
            user.username = username
            # Example of validations (you can add more if needed)
            if len(username) < 3:
                raise ValueError("Username must be at least 3 characters long")
        if  firstname:
            user.firstname = firstname
        if  lastname:
            user.lastname = lastname
        if email:
            user.email = email
            if not email or '@' not in email:
                raise ValueError("Invalid email format")
        db.session.commit()
        return user