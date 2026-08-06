import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
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
