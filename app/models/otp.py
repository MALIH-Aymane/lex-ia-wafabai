from utils.extensions import db
from datetime import datetime, timedelta
import random

class PasswordResetOTP(db.Model):
    __tablename__ = 'password_reset_otps'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), nullable=False, index=True)
    otp_code = db.Column(db.String(10), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @classmethod
    def generate_otp(cls, email: str, validity_minutes: int = 15) -> str:
        """
        Generate a 6-digit OTP code for the given email.
        Deletes any old pending OTP records for this email first.
        """
        code = f"{random.randint(100000, 999999)}"
        expires = datetime.utcnow() + timedelta(minutes=validity_minutes)

        # Clear existing OTPs for this email
        cls.query.filter_by(email=email).delete()

        otp_record = cls(email=email, otp_code=code, expires_at=expires)
        db.session.add(otp_record)
        db.session.commit()
        return code

    @classmethod
    def validate_otp(cls, email: str, code: str) -> tuple[bool, str]:
        """
        Validate OTP code for email. Returns (is_valid, error_or_success_msg).
        """
        clean_code = str(code).strip()
        record = cls.query.filter_by(email=email.strip().lower()).order_by(cls.id.desc()).first()

        if not record:
            return False, "Aucun code OTP n'a été demandé pour cette adresse e-mail."
        if record.otp_code != clean_code:
            return False, "Code OTP incorrect. Veuillez vérifier le code reçu par e-mail."
        if datetime.utcnow() > record.expires_at:
            return False, "Le code OTP a expiré (valide 15 minutes). Veuillez en demander un nouveau."

        return True, "Code OTP valide."

    @classmethod
    def clear_otp(cls, email: str):
        """Delete OTP record once password has been successfully reset."""
        cls.query.filter_by(email=email.strip().lower()).delete()
        db.session.commit()
