import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app

def send_otp_email(to_email: str, otp_code: str):
    """
    Send a styled HTML email with an OTP code using SMTP SSL (port 465).
    Uses MAIL_SERVER, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD from Config.
    """
    server = current_app.config.get('MAIL_SERVER', 'ai.casoft.ma')
    port = int(current_app.config.get('MAIL_PORT', 465))
    username = current_app.config.get('MAIL_USERNAME', 'lex-ia@ai.casoft.ma')
    password = current_app.config.get('MAIL_PASSWORD', 'q&-$HLm+1Bb3wHCx')

    msg = MIMEMultipart('alternative')
    msg['Subject'] = f"🔒 Code de réinitialisation LEX-IA : {otp_code}"
    msg['From'] = f"LEX-IA Support <{username}>"
    msg['To'] = to_email

    html_body = f"""
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
      <div style="background: #0a1f4e; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 1px;">LEX<span style="color: #00a693;">-IA</span></h1>
        <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">Plateforme d'Intelligence Artificielle Juridique</p>
      </div>
      <div style="padding: 32px 24px; color: #334155;">
        <h2 style="font-size: 18px; color: #0a1f4e; margin-top: 0;">Mot de passe oublié</h2>
        <p style="font-size: 14px; color: #64748b; line-height: 1.6;">
          Vous avez demandé à réinitialiser votre mot de passe sur la plateforme <strong>LEX-IA</strong>.
          Voici votre code de vérification unique (OTP) :
        </p>
        
        <div style="margin: 28px 0; text-align: center;">
          <div style="display: inline-block; background: #f8fafc; border: 2px dashed #00a693; border-radius: 10px; padding: 14px 28px; letter-spacing: 10px; font-size: 32px; font-weight: 800; color: #0a1f4e;">
            {otp_code}
          </div>
        </div>

        <p style="font-size: 13px; color: #64748b; text-align: center;">
          Ce code est valide pendant <strong>15 minutes</strong>.
        </p>
      </div>
      <div style="background: #f8fafc; padding: 16px 24px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
        Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.
      </div>
    </div>
    """

    msg.attach(MIMEText(html_body, 'html', 'utf-8'))

    with smtplib.SMTP_SSL(server, port, timeout=12) as mailer:
        mailer.login(username, password)
        mailer.sendmail(username, [to_email], msg.as_string())
