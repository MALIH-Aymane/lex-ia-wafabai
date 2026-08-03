import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
<div class="login-page">
  <!-- Left panel -->
  <div class="login-left bg-network">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="left-content">
      <div class="brand">
        <img src="assets/logo.png" alt="LEX-IA" class="brand-logo" />
        <div class="brand-name">LEX<span class="ia">-IA</span></div>
        <div class="brand-sub">Legal Search & AI Interpretation</div>
      </div>

      <div class="quote-block">
        <div class="quote-bar"></div>
        <p class="quote-text">
          "La connaissance des lois ne consiste pas à se souvenir de leur texte,
          mais à en pénétrer l'esprit."
        </p>
        <span class="quote-author">— Justinien Ier</span>
      </div>

      <div class="left-features">
        <div class="feat" *ngFor="let f of features">
          <span class="feat-icon">{{ f.icon }}</span>
          <span>{{ f.label }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Right panel -->
  <div class="login-right">
    <div class="login-box animate-fadeInUp">
      <!-- Mobile logo -->
      <div class="mobile-brand">
        <img src="assets/logo.png" alt="LEX-IA" class="brand-logo-sm" />
        <span class="brand-name-sm">LEX<span class="ia">-IA</span></span>
      </div>

      <div class="login-header">
        <h1>Bon retour</h1>
        <p>Connectez-vous pour accéder à votre espace juridique.</p>
      </div>

      <!-- Error -->
      <div class="alert-error" *ngIf="error()">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        {{ error() }}
      </div>

      <form (ngSubmit)="onSubmit()" #loginForm="ngForm" class="login-form">
        <div class="form-group">
          <label class="form-label" for="username">Identifiant</label>
          <div class="input-wrapper">
            <svg class="input-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            <input id="username" class="form-control input-with-icon" type="text"
              placeholder="Email ou nom d'utilisateur"
              [(ngModel)]="username" name="username" required
              [class.error]="submitted && !username" />
          </div>
        </div>

        <div class="form-group">
          <div class="label-row">
            <label class="form-label" for="password">Mot de passe</label>
            <a type="button" class="forgot-link" (click)="openForgotModal()">Mot de passe oublié ?</a>
          </div>
          <div class="input-wrapper">
            <svg class="input-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input id="password" class="form-control input-with-icon" [type]="showPass ? 'text' : 'password'"
              placeholder="••••••••"
              [(ngModel)]="password" name="password" required
              [class.error]="submitted && !password" />
            <button type="button" class="toggle-pass" (click)="showPass = !showPass" title="Afficher / masquer">
              <svg *ngIf="!showPass" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg *ngIf="showPass" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
        </div>

        <button id="login-btn" class="btn btn-primary btn-full" type="submit" [disabled]="loading()">
          <span class="spinner" *ngIf="loading()"></span>
          <span *ngIf="!loading()">
            Se connecter
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </span>
        </button>
      </form>

      <div class="login-footer">
        <a routerLink="/">← Retour à l'accueil</a>
      </div>
    </div>
  </div>
</div>

<!-- FORGOT PASSWORD OTP MODAL -->
<div class="forgot-overlay" *ngIf="showForgotModal()" (click)="closeForgotModal($event)">
  <div class="forgot-modal animate-fadeInUp">
    <button class="modal-close" (click)="closeForgotModal()">✕</button>

    <!-- Error Alert inside modal -->
    <div class="alert-error" *ngIf="forgotError()">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      {{ forgotError() }}
    </div>

    <!-- STEP 1: Enter Email -->
    <div class="modal-step" *ngIf="forgotStep() === 1">
      <div class="modal-icon">🔒</div>
      <h2>Mot de passe oublié</h2>
      <p class="modal-sub">Saisissez votre adresse e-mail pour recevoir un code de vérification unique (OTP).</p>

      <div class="form-group">
        <label class="form-label">Adresse e-mail ou nom d'utilisateur</label>
        <input class="form-control" type="text" [(ngModel)]="forgotEmail" placeholder="nom@exemple.com" (keyup.enter)="sendForgotOtp()" />
      </div>

      <button class="btn btn-primary btn-full" (click)="sendForgotOtp()" [disabled]="forgotLoading() || !forgotEmail">
        <span class="spinner" *ngIf="forgotLoading()"></span>
        <span *ngIf="!forgotLoading()">Envoyer le code OTP</span>
      </button>
    </div>

    <!-- STEP 2: Enter OTP Code -->
    <div class="modal-step" *ngIf="forgotStep() === 2">
      <div class="modal-icon">✉️</div>
      <h2>Code de vérification OTP</h2>
      <p class="modal-sub">{{ forgotSuccessMsg() || 'Saisissez le code à 6 chiffres envoyé sur votre e-mail.' }}</p>

      <div class="form-group">
        <label class="form-label">Code OTP (6 chiffres)</label>
        <input class="form-control otp-input" type="text" maxlength="6" [(ngModel)]="forgotOtp" placeholder="123456" (keyup.enter)="verifyForgotOtp()" />
      </div>

      <button class="btn btn-primary btn-full" (click)="verifyForgotOtp()" [disabled]="forgotLoading() || forgotOtp.length < 4">
        <span class="spinner" *ngIf="forgotLoading()"></span>
        <span *ngIf="!forgotLoading()">Valider le code</span>
      </button>

      <button class="btn-link-sm" (click)="sendForgotOtp()" [disabled]="forgotLoading()">
        Renvoyer un nouveau code OTP
      </button>
    </div>

    <!-- STEP 3: Enter New Password -->
    <div class="modal-step" *ngIf="forgotStep() === 3">
      <div class="modal-icon">🔑</div>
      <h2>Nouveau mot de passe</h2>
      <p class="modal-sub">Définissez votre nouveau mot de passe sécurisé.</p>

      <div class="form-group">
        <label class="form-label">Nouveau mot de passe</label>
        <input class="form-control" type="password" [(ngModel)]="forgotNewPassword" placeholder="••••••••" />
      </div>

      <div class="form-group">
        <label class="form-label">Confirmer le mot de passe</label>
        <input class="form-control" type="password" [(ngModel)]="forgotConfirmPassword" placeholder="••••••••" (keyup.enter)="submitNewPassword()" />
      </div>

      <button class="btn btn-primary btn-full" (click)="submitNewPassword()" [disabled]="forgotLoading() || !forgotNewPassword">
        <span class="spinner" *ngIf="forgotLoading()"></span>
        <span *ngIf="!forgotLoading()">Réinitialiser le mot de passe</span>
      </button>
    </div>

    <!-- STEP 4: Success -->
    <div class="modal-step text-center" *ngIf="forgotStep() === 4">
      <div class="modal-icon success-icon">✅</div>
      <h2>Mot de passe réinitialisé !</h2>
      <p class="modal-sub">{{ forgotSuccessMsg() }}</p>

      <button class="btn btn-primary btn-full" (click)="closeForgotModal()">
        Se connecter avec le nouveau mot de passe
      </button>
    </div>
  </div>
</div>
  `,
  styles: [`
    .login-page { display: flex; min-height: 100vh; }

    /* LEFT */
    .login-left {
      flex: 1; position: relative; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      padding: 60px 48px;
    }
    @media (max-width: 768px) { .login-left { display: none; } }
    .orb { position: absolute; border-radius: 50%; filter: blur(70px); pointer-events: none; }
    .orb-1 { width: 350px; height: 350px; background: rgba(0,166,147,.25); top: -80px; right: -60px; }
    .orb-2 { width: 250px; height: 250px; background: rgba(10,31,78,.5); bottom: 40px; left: -40px; }

    .left-content { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 48px; max-width: 360px; }
    .brand { display: flex; flex-direction: column; gap: 6px; }
    .brand-logo { width: 56px; }
    .brand-name { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; color: #fff; }
    .ia { color: #ff7a00; }
    .brand-sub { font-size: 13px; color: rgba(255,255,255,.5); font-weight: 500; letter-spacing: .5px; text-transform: uppercase; }

    .quote-block { display: flex; gap: 16px; }
    .quote-bar { width: 3px; background: var(--primary-grad); border-radius: 99px; flex-shrink: 0; }
    .quote-text { font-size: 15px; color: rgba(255,255,255,.75); line-height: 1.7; font-style: italic; margin-bottom: 8px; }
    .quote-author { font-size: 13px; color: rgba(255,255,255,.4); font-weight: 600; }

    .left-features { display: flex; flex-direction: column; gap: 12px; }
    .feat { display: flex; align-items: center; gap: 12px; color: rgba(255,255,255,.7); font-size: 14px; }
    .feat-icon { font-size: 18px; }

    /* RIGHT */
    .login-right {
      width: 480px; display: flex; align-items: center; justify-content: center;
      padding: 40px 32px; background: var(--bg);
    }
    @media (max-width: 768px) { .login-right { width: 100%; } }

    .login-box { width: 100%; max-width: 400px; }
    .mobile-brand { display: none; align-items: center; gap: 10px; margin-bottom: 32px; justify-content: center; }
    @media (max-width: 768px) { .mobile-brand { display: flex; } }
    .brand-logo-sm { width: 36px; }
    .brand-name-sm { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: var(--navy); }

    .login-header { margin-bottom: 32px; }
    .login-header h1 { font-size: 30px; color: var(--navy); margin-bottom: 8px; }
    .login-header p { font-size: 14px; color: var(--text-muted); }

    .alert-error {
      display: flex; align-items: center; gap: 8px;
      background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.2);
      color: #dc2626; padding: 12px 16px; border-radius: 10px;
      font-size: 14px; margin-bottom: 20px;
    }

    .login-form { display: flex; flex-direction: column; }
    .input-wrapper { position: relative; }
    .input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-light); pointer-events: none; }
    .input-with-icon { padding-left: 44px; padding-right: 44px; }
    .toggle-pass {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: var(--text-light);
      display: flex; padding: 0;
    }
    .toggle-pass:hover { color: var(--text); }

    .btn-full { margin-top: 8px; padding: 14px; font-size: 15px; }

    .login-footer { margin-top: 28px; text-align: center; }
    .label-row { display: flex; align-items: center; justify-content: space-between; }
    .forgot-link { font-size: 12px; color: var(--primary); font-weight: 600; cursor: pointer; text-decoration: none; }
    .forgot-link:hover { text-decoration: underline; }

    /* MODAL FORGOT PASSWORD */
    .forgot-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.5); backdrop-filter: blur(4px);
      z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .forgot-modal {
      background: var(--bg-white); border-radius: 16px; width: 100%; max-width: 440px;
      padding: 32px; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,.2);
      border: 1px solid var(--border);
    }
    .modal-close {
      position: absolute; top: 16px; right: 16px; background: none; border: none;
      font-size: 18px; cursor: pointer; color: var(--text-muted); padding: 4px 8px; border-radius: 6px;
    }
    .modal-close:hover { background: var(--bg); color: var(--navy); }

    .modal-step { display: flex; flex-direction: column; gap: 16px; }
    .modal-icon { font-size: 40px; margin-bottom: 4px; }
    .success-icon { font-size: 48px; }
    .modal-step h2 { font-size: 22px; color: var(--navy); margin-bottom: 2px; }
    .modal-sub { font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 8px; }

    .otp-input {
      font-size: 24px; font-weight: 700; letter-spacing: 8px; text-align: center;
      padding: 12px; font-family: monospace; color: var(--navy); border-color: var(--primary);
    }
    .btn-link-sm {
      background: none; border: none; font-size: 12px; color: var(--primary);
      cursor: pointer; font-weight: 600; text-align: center; margin-top: 4px;
    }
    .btn-link-sm:hover { text-decoration: underline; }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  showPass = false;
  submitted = false;
  error = signal('');
  loading = signal(false);

  // Forgot password OTP modal
  showForgotModal = signal(false);
  forgotStep = signal<1 | 2 | 3 | 4>(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  forgotEmail = '';
  forgotOtp = '';
  forgotNewPassword = '';
  forgotConfirmPassword = '';
  forgotLoading = signal(false);
  forgotError = signal('');
  forgotSuccessMsg = signal('');

  features = [
    { icon: '🔍', label: 'Recherche sémantique IA' },
    { icon: '⚖️', label: 'Base légale marocaine complète' },
    { icon: '🧠', label: 'Interprétation par LLM' },
    { icon: '🛡️', label: 'Accès sécurisé par rôle' },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['expired'] === '1') {
        this.error.set('Votre session a expiré. Veuillez vous ré-authentifier pour continuer.');
      }
    });

    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit() {
    this.submitted = true;
    if (!this.username || !this.password) return;

    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.msg ?? 'Identifiants incorrects. Veuillez réessayer.');
      }
    });
  }

  openForgotModal() {
    this.showForgotModal.set(true);
    this.forgotStep.set(1);
    this.forgotEmail = this.username && this.username.includes('@') ? this.username : '';
    this.forgotOtp = '';
    this.forgotNewPassword = '';
    this.forgotConfirmPassword = '';
    this.forgotError.set('');
    this.forgotSuccessMsg.set('');
  }

  closeForgotModal(event?: MouseEvent) {
    if (event && !(event.target as HTMLElement).classList.contains('forgot-overlay')) return;
    this.showForgotModal.set(false);
  }

  sendForgotOtp() {
    if (!this.forgotEmail || !this.forgotEmail.trim()) {
      this.forgotError.set('Veuillez saisir votre adresse e-mail ou nom d\'utilisateur.');
      return;
    }
    this.forgotLoading.set(true);
    this.forgotError.set('');

    this.auth.forgotPassword(this.forgotEmail.trim()).subscribe({
      next: (res) => {
        this.forgotLoading.set(false);
        this.forgotSuccessMsg.set(res.msg);
        this.forgotStep.set(2);
      },
      error: (err) => {
        this.forgotLoading.set(false);
        this.forgotError.set(err.error?.msg ?? 'Erreur lors de l\'envoi du code OTP.');
      }
    });
  }

  verifyForgotOtp() {
    if (!this.forgotOtp || this.forgotOtp.trim().length < 4) {
      this.forgotError.set('Veuillez saisir le code OTP reçu par e-mail.');
      return;
    }
    this.forgotLoading.set(true);
    this.forgotError.set('');

    this.auth.verifyOtp(this.forgotEmail.trim(), this.forgotOtp.trim()).subscribe({
      next: (res) => {
        this.forgotLoading.set(false);
        this.forgotStep.set(3);
      },
      error: (err) => {
        this.forgotLoading.set(false);
        this.forgotError.set(err.error?.msg ?? 'Code OTP invalide ou expiré.');
      }
    });
  }

  submitNewPassword() {
    if (!this.forgotNewPassword) {
      this.forgotError.set('Veuillez saisir votre nouveau mot de passe.');
      return;
    }
    if (this.forgotNewPassword.length < 4) {
      this.forgotError.set('Le mot de passe doit contenir au moins 4 caractères.');
      return;
    }
    if (this.forgotNewPassword !== this.forgotConfirmPassword) {
      this.forgotError.set('Les deux mots de passe ne correspondent pas.');
      return;
    }

    this.forgotLoading.set(true);
    this.forgotError.set('');

    this.auth.resetPasswordOtp(this.forgotEmail.trim(), this.forgotOtp.trim(), this.forgotNewPassword).subscribe({
      next: (res) => {
        this.forgotLoading.set(false);
        this.forgotSuccessMsg.set(res.msg);
        this.forgotStep.set(4);
      },
      error: (err) => {
        this.forgotLoading.set(false);
        this.forgotError.set(err.error?.msg ?? 'Erreur lors de la réinitialisation.');
      }
    });
  }
}
