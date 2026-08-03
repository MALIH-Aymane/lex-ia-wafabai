# dao/role_dao.py
from models.role import Role
from utils.extensions import db

class RoleDAO:
    @staticmethod
    def get_all_roles():
        return Role.query.all()

    @staticmethod
    def get_role_by_id(role_id):
        return Role.query.get(role_id)

    @staticmethod
    def get_role_by_name(name):
        return Role.query.filter_by(name=name).first()

    @staticmethod
    def create_role(name, description=''):
        new_role = Role(name=name, description=description)
        db.session.add(new_role)
        db.session.commit()
        return new_role

    @staticmethod
    def update_role(role, name, description):
        role.name = name
        role.description = description
        db.session.commit()
        return role

    @staticmethod
    def delete_role(role):
        db.session.delete(role)
        db.session.commit()
