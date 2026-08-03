from utils.extensions import db
from enum import Enum


class StatusEnum(Enum):
    ACTIVE = "active"
    NOT_ACTIVE = "not_active"
    UNDER_DEVELOPMENT = "under_development"


class Model(db.Model):
    __tablename__ = "models"
    id = db.Column(db.Integer, primary_key=True)
    modelname = db.Column(db.String(255))
    modelexecutetype = db.Column(db.String(255))
    modelexecute = db.Column(db.String(255))
    collectionname = db.Column(db.String(255))
    description = db.Column(db.String(255))
    datecreation = db.Column(db.Date, nullable=False)
    status = db.Column(db.Enum(StatusEnum), nullable=False)
    ishidden = db.Column(db.Boolean, default=False)


    def __init__(self, modelname, modelexecutetype, modelexecute, collectionname, description, datecreation, status, ishidden):
        self.modelname = modelname
        self.modelexecutetype = modelexecutetype
        self.modelexecute = modelexecute
        self.collectionname = collectionname
        self.description = description
        self.datecreation = datecreation
        self.status = status
        self.ishidden = ishidden

    def __repr__(self):
        return (f"<Model(id={self.id}, modelname='{self.modelname}', "
                f"modelexecutetype='{self.modelexecutetype}', modelexecute='{self.modelexecute}', "
                f"collectionname='{self.collectionname}', description='{self.description}', "
                f"datecreation={self.datecreation}, status={self.status}, ishidden={self.ishidden})>")

    def as_dict(self):
        return {
            'id': self.id,
            'modelname': self.modelname,
            'modelexecutetype': self.modelexecutetype,
            'modelexecute': self.modelexecute,
            'collectionname': self.collectionname,
            'description': self.description,
            'datecreation': self.datecreation,
            'status': self.status.value,
            'ishidden': self.ishidden
        }
