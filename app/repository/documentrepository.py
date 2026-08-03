from models.document import Document

class DocumentDAL:
    @staticmethod
    def get_document_by_id(document_id):
        try:
            return Document.query.get(document_id)
        except SQLAlchemyError as e:
            print(f"Error occurred: {e}")
            return None

    @staticmethod
    def create_document(name, type, date, status, ishidden):
        try:
            document = Document (name=name, type=type, date=date, status=status, ishidden=ishidden)
            db.session.add(document)
            db.session.commit()
            return document
        except SQLAlchemyError as e:
            print(f"Error occurred: {e}")
            db.session.rollback()
            return None

    @staticmethod
    def update_document(document_id, name=None, type=None, date=None, status=None, ishidden=None):
        document = DocumentDAL.get_document_by_id(document_id)
        if not document:
            return None
        try:
            if name:
                document.name = name
            if type:
                document.type = type
            if date:
                document.date = date
            if status:
                document.status = status
            if ishidden is not None:
                document.ishidden = ishidden
            db.session.commit()
            return document
        except SQLAlchemyError as e:
            print(f"Error occurred: {e}")
            db.session.rollback()
            return None

    @staticmethod
    def delete_document(document_id):
        document = DocumentDAL.get_document_by_id(document_id)
        if not document:
            return False
        try:
            db.session.delete(document)
            db.session.commit()
            return True
        except SQLAlchemyError as e:
            print(f"Error occurred: {e}")
            db.session.rollback()
            return False