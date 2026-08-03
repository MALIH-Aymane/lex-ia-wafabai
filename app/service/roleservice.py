# services/role_service.py

from repository.roledao import RoleDAO
from models.role import Role

class RoleService:
    @staticmethod
    def get_all_roles():
        return RoleDAO.get_all_roles()

    @staticmethod
    def get_role_by_id(role_id):
        return RoleDAO.get_role_by_id(role_id)

    @staticmethod
    def create_role(name, description=''):
        if RoleDAO.get_role_by_name(name):
            raise ValueError("Role with this name already exists")
        if not name or not isinstance(name, str) or len(name) < 3:
            raise ValueError("Invalid role name")

        return RoleDAO.create_role(name, description)

    @staticmethod
    def update_role(role_id, name, description):
        role = RoleDAO.get_role_by_id(role_id)
        if not role:
            raise ValueError("Role not found")
        if RoleDAO.get_role_by_name(name) and RoleDAO.get_role_by_name(name).id != role_id:
            raise ValueError("Another role with this name already exists")
        if not name or not isinstance(name, str) or len(name) < 3:
            raise ValueError("Invalid role name")

        return RoleDAO.update_role(role, name, description)

    @staticmethod
    def delete_role(role_id):
        role = RoleDAO.get_role_by_id(role_id)
        if not role:
            raise ValueError("Role not found")

        RoleDAO.delete_role(role)
        return role

    @staticmethod
    def get_role_by_name(name):
        return RoleDAO.get_role_by_name(name)
