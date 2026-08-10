import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="profile-page">
  <div class="profile-grid">

    <!-- Left: Avatar card -->
    <div class="avatar-card card animate-fadeInUp">
      <div class="avatar-wrapper">
        <img *ngIf="avatarUrl()" [src]="avatarUrl()" class="avatar-img" alt="Avatar" />
        <div *ngIf="!avatarUrl()" class="avatar-circle">{{ initials() }}</div>

        <button type="button" class="avatar-edit-btn" (click)="fileInput.click()" title="Changer la photo de profil">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </button>
        <input #fileInput type="file" (change)="onFileSelected($event)" accept="image/*" style="display:none" />
      </div>

      <button type="button" class="btn-change-photo" (click)="fileInput.click()" [disabled]="avatarUploading()">
        <span class="spinner" *ngIf="avatarUploading()"></span>
        <span *ngIf="!avatarUploading()">📷 {{ avatarUrl() ? 'Modifier la photo' : 'Ajouter une photo' }}</span>
      </button>

      <div class="alert-success-sm" *ngIf="avatarSuccess()">{{ avatarSuccess() }}</div>
      <div class="alert-error-sm" *ngIf="avatarError()">{{ avatarError() }}</div>

      <h2 class="profile-name">{{ fullName() }}</h2>
      <span class="badge badge-navy">{{ roleName() }}</span>
      <p class="profile-email">{{ user()?.email }}</p>

      <div class="profile-stats">
        <div class="ps-item">
          <span class="ps-val">—</span>
          <span class="ps-lbl">Recherches</span>
        </div>
        <div class="ps-div"></div>
        <div class="ps-item">
          <span class="ps-val">—</span>
          <span class="ps-lbl">Questions</span>
        </div>
      </div>
    </div>

    <!-- Right: Edit form -->
    <div class="edit-card card animate-fadeInUp" style="animation-delay:.08s">
      <div class="card-header-row">
        <h3>Informations personnelles</h3>
        <span class="badge badge-teal" *ngIf="saved()">✓ Sauvegardé</span>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Prénom</label>
          <input class="form-control" [(ngModel)]="form.firstname" />
        </div>
        <div class="form-group">
          <label class="form-label">Nom</label>
          <input class="form-control" [(ngModel)]="form.lastname" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Email</label>
          <input class="form-control" type="email" [(ngModel)]="form.email" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Nom d'utilisateur</label>
          <input class="form-control" [(ngModel)]="form.username" />
        </div>
      </div>

      <button class="btn btn-primary" (click)="saveProfile()" [disabled]="loading()">
        <span class="spinner" *ngIf="loading()"></span>
        <span *ngIf="!loading()">Enregistrer les modifications</span>
      </button>

      <!-- Password change -->
      <div class="divider" style="margin:28px 0">Changer le mot de passe</div>

      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Mot de passe actuel</label>
          <input class="form-control" type="password" [(ngModel)]="pw.current" placeholder="••••••••" />
        </div>
        <div class="form-group">
          <label class="form-label">Nouveau mot de passe</label>
          <input class="form-control" type="password" [(ngModel)]="pw.new_password" placeholder="••••••••" />
        </div>
        <div class="form-group">
          <label class="form-label">Confirmer</label>
          <input class="form-control" type="password" [(ngModel)]="pw.confirm" placeholder="••••••••" />
        </div>
      </div>
      <div class="form-error" *ngIf="pwError()">{{ pwError() }}</div>
      <button class="btn btn-outline" (click)="changePassword()">Modifier le mot de passe</button>
    </div>

  </div>
</div>
  `,
  styles: [`
    .profile-page { display: flex; flex-direction: column; gap: 24px; }
    .profile-grid { display: grid; grid-template-columns: 280px 1fr; gap: 20px; align-items: flex-start; }
    @media (max-width: 900px) { .profile-grid { grid-template-columns: 1fr; } }

    /* AVATAR */
    .avatar-card { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px; text-align: center; }
    .avatar-wrapper { position: relative; width: 96px; height: 96px; margin-bottom: 4px; }
    .avatar-circle {
      width: 96px; height: 96px; border-radius: 50%;
      background: var(--primary-grad); color: #fff;
      font-size: 32px; font-weight: 700; display: flex; align-items: center; justify-content: center;
      box-shadow: var(--shadow-teal);
    }
    .avatar-img {
      width: 96px; height: 96px; border-radius: 50%; object-fit: cover;
      border: 3px solid var(--primary); box-shadow: var(--shadow-md);
    }
    .avatar-edit-btn {
      position: absolute; bottom: 0; right: 0; width: 30px; height: 30px;
      border-radius: 50%; background: var(--navy); color: #fff; border: 2px solid #fff;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,.2); transition: transform .15s;
    }
    .avatar-edit-btn:hover { transform: scale(1.1); background: var(--primary-dark); }

    .btn-change-photo {
      background: rgba(0,166,147,.1); color: var(--primary-dark); border: none;
      padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: background .15s;
    }
    .btn-change-photo:hover { background: rgba(0,166,147,.2); }

    .alert-success-sm { font-size: 11px; color: #059669; font-weight: 600; }
    .alert-error-sm { font-size: 11px; color: #dc2626; font-weight: 600; }

    .profile-name { font-size: 20px; color: var(--navy); }
    .profile-email { font-size: 13px; color: var(--text-muted); }
    .profile-stats { display: flex; align-items: center; gap: 20px; margin-top: 8px; }
    .ps-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .ps-val { font-size: 20px; font-weight: 700; color: var(--navy); font-family: 'Playfair Display', serif; }
    .ps-lbl { font-size: 11px; color: var(--text-light); }
    .ps-div { width: 1px; height: 32px; background: var(--border); }

    /* EDIT */
    .edit-card { padding: 28px; }
    .card-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .card-header-row h3 { font-size: 16px; color: var(--navy); }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
    .form-error { color: var(--danger); font-size: 13px; margin-bottom: 12px; }
  `]
})
export class ProfileComponent implements OnInit {
  user = computed(() => this.auth.currentUser());
  fullName = computed(() => (`${this.user()?.firstname ?? ''} ${this.user()?.lastname ?? ''}`.trim()) || (this.user()?.username ?? ''));
  initials = computed(() => { const n = this.fullName(); return n.split(' ').map((p: string) => p[0] ?? '').join('').toUpperCase().slice(0, 2); });
  roleName = computed(() => this.auth.getRoleName());
  avatarUrl = computed(() => this.auth.getAvatarUrl());

  form = { firstname: '', lastname: '', email: '', username: '' };
  pw = { current: '', new_password: '', confirm: '' };
  loading = signal(false);
  saved = signal(false);
  pwError = signal('');

  avatarUploading = signal(false);
  avatarSuccess = signal('');
  avatarError = signal('');

  constructor(private auth: AuthService, private http: HttpClient) {}

  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    const file = target.files[0];
    this.avatarUploading.set(true);
    this.avatarSuccess.set('');
    this.avatarError.set('');

    this.auth.uploadAvatar(file).subscribe({
      next: (res) => {
        this.avatarUploading.set(false);
        this.avatarSuccess.set(res.msg || 'Photo de profil mise à jour !');
        setTimeout(() => this.avatarSuccess.set(''), 3500);
      },
      error: (err) => {
        this.avatarUploading.set(false);
        this.avatarError.set(err.error?.msg ?? 'Erreur lors de l\'envoi de la photo.');
      }
    });
  }

  ngOnInit() {
    const u = this.user();
    if (u) this.form = { firstname: u.firstname ?? '', lastname: u.lastname ?? '', email: u.email, username: u.username };
  }

  saveProfile() {
    this.loading.set(true);
    const token = this.auth.token() || '';
    const headers = { Authorization: `Bearer ${token}` };
    this.http.put<any>(`${environment.apiUrl}/api/auth/update_profile`, this.form, { headers }).subscribe({
      next: (updatedUser) => {
        this.loading.set(false);
        this.saved.set(true);
        // Update local auth state so UI reflects new name/email immediately
        if (updatedUser) {
          localStorage.setItem('lex_user', JSON.stringify(updatedUser));
          this.auth.currentUser.set(updatedUser);
        }
        setTimeout(() => this.saved.set(false), 2500);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Profile update failed:', err);
      }
    });
  }

  changePassword() {
    this.pwError.set('');
    if (this.pw.new_password !== this.pw.confirm) { this.pwError.set('Les mots de passe ne correspondent pas.'); return; }
    const token = this.auth.token() || '';
    const headers = { Authorization: `Bearer ${token}` };
    this.http.post(`${environment.apiUrl}/api/auth/change_password`, { current_password: this.pw.current, new_password: this.pw.new_password }, { headers })
      .subscribe({ next: () => { this.pw = { current: '', new_password: '', confirm: '' }; }, error: e => this.pwError.set(e.error?.msg ?? 'Erreur') });
  }
}
