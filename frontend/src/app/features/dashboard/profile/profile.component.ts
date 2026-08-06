import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
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
    this.http.put<any>('http://127.0.0.1:5000/api/auth/update_profile', this.form, { headers }).subscribe({
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
    this.http.post('http://127.0.0.1:5000/api/auth/change_password', { current_password: this.pw.current, new_password: this.pw.new_password }, { headers })
      .subscribe({ next: () => { this.pw = { current: '', new_password: '', confirm: '' }; }, error: e => this.pwError.set(e.error?.msg ?? 'Erreur') });
  }
}
