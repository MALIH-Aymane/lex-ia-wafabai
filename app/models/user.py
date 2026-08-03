from utils.extensions import db
from flask_bcrypt import generate_password_hash, check_password_hash


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    firstname = db.Column(db.String(150), nullable=False)
    lastname = db.Column(db.String(150),  nullable=False)
    password = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    is_blocked = db.Column(db.Boolean, default=False)
    must_change_password = db.Column(db.Boolean, default=False)
    role_id = db.Column(db.Integer, db.ForeignKey('role.id'), nullable=False)
    role = db.relationship('Role', backref=db.backref('users', lazy=True))
    avatar = db.Column(db.String(255), nullable=True)

    def set_password(self, password):
        self.password= generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

    def verify_password(self, password):
        return check_password_hash(self.password, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'firstname': self.firstname,
            'lastname': self.lastname,
            'is_blocked': self.is_blocked,
            'must_change_password': self.must_change_password,
            'role': self.role.to_dict(),
            'avatar': getattr(self, 'avatar', None)
        }

    def __str__(self):
        return f"User(id={self.id}, username='{self.username}', email='{self.email}', lastname='{self.lastname}', firstname='{self.firstname}', role={self.role.name})"
