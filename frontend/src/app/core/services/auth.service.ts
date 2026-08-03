import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';

export interface User {
  id: number;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  role: { name: string } | string;
  avatar?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = 'http://127.0.0.1:5000/api/auth';
  private readonly USER_API = 'http://127.0.0.1:5000/api/user';

  currentUser = signal<User | null>(null);
  token = signal<string | null>(null);

  constructor(private http: HttpClient, private router: Router) {
    this.restoreSession();
  }

  getAvatarUrl(userTarget?: User | null): string {
    const u = userTarget !== undefined ? userTarget : this.currentUser();
    if (u && u.avatar) {
      return `${this.USER_API}/avatars/${u.avatar}?t=${encodeURIComponent(u.avatar)}`;
    }
    return '';
  }

  uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const headers = {
      'Authorization': `Bearer ${this.token()}`
    };

    return this.http.post<{ msg: string; avatar: string; user: User }>(`${this.USER_API}/upload_avatar`, formData, { headers }).pipe(
      tap(res => {
        if (res.user) {
          localStorage.setItem('lex_user', JSON.stringify(res.user));
          this.currentUser.set(res.user);
        }
      })
    );
  }

  login(username: string, password: string) {
    return this.http.post<{ token: string; user: User }>(`${this.API}/login`, { username, password }).pipe(
      tap(res => {
        localStorage.setItem('lex_token', res.token);
        localStorage.setItem('lex_user', JSON.stringify(res.user));
        this.token.set(res.token);
        this.currentUser.set(res.user);
      })
    );
  }

  logout() {
    this.http.post(`${this.API}/logout`, {}).subscribe();
    localStorage.removeItem('lex_token');
    localStorage.removeItem('lex_user');
    this.token.set(null);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  forgotPassword(email: string) {
    return this.http.post<{ msg: string; email: string }>(`${this.API}/forgot_password`, { email });
  }

  verifyOtp(email: string, otp: string) {
    return this.http.post<{ valid: boolean; msg: string }>(`${this.API}/verify_otp`, { email, otp });
  }

  resetPasswordOtp(email: string, otp: string, new_password: string) {
    return this.http.post<{ msg: string }>(`${this.API}/reset_password_otp`, { email, otp, new_password });
  }

  isAuthenticated(): boolean {
    return !!this.token() && !this.isTokenExpired();
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  isTokenExpired(): boolean {
    const t = this.token();
    if (!t) return true;
    try {
      const parts = t.split('.');
      if (parts.length !== 3) return true;
      const payloadBase64 = parts[1];
      const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);
      if (!payload.exp) return false;
      return (Date.now() / 1000) >= payload.exp;
    } catch {
      return true;
    }
  }

  getRoleName(): string {
    const user = this.currentUser();
    if (!user) return '';
    const role = user.role;
    return typeof role === 'string' ? role : role?.name ?? '';
  }

  hasRole(roles: string[]): boolean {
    return roles.includes(this.getRoleName());
  }

  clearSession() {
    localStorage.removeItem('lex_token');
    localStorage.removeItem('lex_user');
    this.token.set(null);
    this.currentUser.set(null);
  }

  private restoreSession() {
    const t = localStorage.getItem('lex_token');
    const u = localStorage.getItem('lex_user');
    if (t && u) {
      this.token.set(t);
      if (this.isTokenExpired()) {
        this.clearSession();
      } else {
        try {
          this.currentUser.set(JSON.parse(u));
        } catch {
          this.clearSession();
        }
      }
    }
  }
}

