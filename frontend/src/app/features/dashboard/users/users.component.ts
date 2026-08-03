import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface User { id: number; username: string; email: string; firstname: string; lastname: string; role: any; is_blocked: boolean; avatar?: string; }

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="users-page">
  <div class="page-header animate-fadeInUp">
    <div>
      <h2>👥 Gestion des utilisateurs</h2>
      <p>Administrez les comptes, les photos de profil et les accès à la plateforme.</p>
    </div>
    <button class="btn btn-primary" (click)="openCreate()">+ Nouvel utilisateur</button>
  </div>

  <!-- Search -->
  <div class="search-bar-row animate-fadeInUp" style="animation-delay:.06s">
    <div class="input-wrapper" style="flex:1">
      <svg class="input-icon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input class="form-control input-with-icon" [(ngModel)]="searchTerm" placeholder="Rechercher un utilisateur..." />
    </div>
    <select class="form-control" style="width:180px" [(ngModel)]="roleFilter">
      <option value="">Tous les rôles</option>
      <option value="Administrateur">Administrateur</option>
      <option value="Responsable juridique">Resp. juridique</option>
      <option value="Utilisateur">Utilisateur</option>
    </select>
  </div>

  <!-- Table -->
  <div class="card animate-fadeInUp" style="animation-delay:.12s; padding:0; overflow:hidden">
    <table class="user-table">
      <thead>
        <tr>
          <th>Utilisateur</th>
          <th>Email</th>
          <th>Rôle</th>
          <th>Statut</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let u of filteredUsers()">
          <td>
            <div class="user-cell">
              <img *ngIf="getAvatarUrl(u)" [src]="getAvatarUrl(u)" class="user-avatar-img" alt="Avatar" />
              <div *ngIf="!getAvatarUrl(u)" class="user-av">{{ initials(u) }}</div>
              <div class="user-name-col">
                <span class="user-fullname">{{ u.firstname }} {{ u.lastname }}</span>
                <span class="user-username">&#64;{{ u.username || u.email }}</span>
              </div>
            </div>
          </td>
          <td class="text-muted">{{ u.email }}</td>
          <td><span class="badge" [class]="roleBadge(roleName(u))">{{ roleName(u) }}</span></td>
          <td>
            <span class="badge" [class]="u.is_blocked ? 'badge-danger' : 'badge-success'">
              {{ u.is_blocked ? 'Bloqué' : 'Actif' }}
            </span>
          </td>
          <td>
            <div class="action-btns">
              <button class="btn btn-ghost btn-sm" (click)="editUser(u)">✏️</button>
              <button class="btn btn-ghost btn-sm" (click)="deleteUser(u.id)" style="color:var(--danger)">🗑️</button>
            </div>
          </td>
        </tr>
        <tr *ngIf="filteredUsers().length === 0">
          <td colspan="5" class="empty-row">Aucun utilisateur trouvé.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Modal -->
  <div class="modal-overlay" *ngIf="showModal()" (click)="showModal.set(false)">
    <div class="modal-box animate-fadeInUp" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>{{ editMode() ? 'Modifier' : 'Créer' }} un utilisateur</h3>
        <button class="modal-close" (click)="showModal.set(false)">✕</button>
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
          <label class="form-label">Email / Identifiant</label>
          <input class="form-control" type="email" [(ngModel)]="form.email" />
        </div>
        <div class="form-group" style="grid-column:1/-1" *ngIf="!editMode()">
          <label class="form-label">Mot de passe</label>
          <input class="form-control" type="password" [(ngModel)]="form.password" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Rôle</label>
          <select class="form-control" [(ngModel)]="form.role">
            <option value="Administrateur">Administrateur</option>
            <option value="Responsable juridique">Responsable juridique</option>
            <option value="Utilisateur">Utilisateur</option>
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" (click)="showModal.set(false)">Annuler</button>
        <button class="btn btn-primary" (click)="saveUser()">{{ editMode() ? 'Enregistrer' : 'Créer' }}</button>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .users-page { display: flex; flex-direction: column; gap: 20px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .page-header h2 { font-size: 20px; color: var(--navy); margin-bottom: 4px; }
    .page-header p { font-size: 13px; color: var(--text-muted); }
    .search-bar-row { display: flex; gap: 12px; align-items: center; }
    .input-wrapper { position: relative; }
    .input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-light); }
    .input-with-icon { padding-left: 38px; }

    .user-table { width: 100%; border-collapse: collapse; }
    .user-table th { background: var(--bg); padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid var(--border); }
    .user-table td { padding: 14px 16px; border-bottom: 1px solid var(--border-light); font-size: 14px; }
    .user-table tr:last-child td { border-bottom: none; }
    .user-table tr:hover td { background: var(--bg); }
    .user-cell { display: flex; align-items: center; gap: 12px; }
    .user-avatar-img {
      width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
      border: 2px solid var(--primary); flex-shrink: 0; box-shadow: var(--shadow-sm);
    }
    .user-av {
      width: 36px; height: 36px; border-radius: 50%; background: var(--navy);
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }
    .user-name-col { display: flex; flex-direction: column; gap: 2px; }
    .user-fullname { font-weight: 600; color: var(--navy); }
    .user-username { font-size: 11px; color: var(--text-muted); }
    .text-muted { color: var(--text-muted); }
    .action-btns { display: flex; gap: 4px; }
    .empty-row { text-align: center; color: var(--text-light); padding: 40px; }

    .badge-admin { background: rgba(10,31,78,.1); color: var(--navy); }
    .badge-juri  { background: rgba(0,166,147,.12); color: var(--primary-dark); }
    .badge-user  { background: rgba(59,130,246,.1); color: #1d4ed8; }
    .badge-danger  { background: rgba(239,68,68,.12); color: #991b1b; }
    .badge-success { background: rgba(16,185,129,.12); color: #065f46; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .modal-box { background: #fff; border-radius: 20px; padding: 32px; width: 100%; max-width: 540px; box-shadow: var(--shadow-lg); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .modal-header h3 { font-size: 18px; color: var(--navy); }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-muted); }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
    .modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; }
  `]
})
export class UsersComponent implements OnInit {
  users = signal<User[]>([]);
  showModal = signal(false);
  editMode = signal(false);
  searchTerm = '';
  roleFilter = '';
  form: any = { firstname: '', lastname: '', email: '', password: '', role: 'Utilisateur' };
  private editingId: number | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() { this.loadUsers(); }

  loadUsers() {
    this.http.get<User[]>('http://127.0.0.1:5000/api/user/users').subscribe({
      next: u => this.users.set(u), error: () => {}
    });
  }

  getAvatarUrl(u: User): string {
    if (u && u.avatar) {
      return `http://127.0.0.1:5000/api/user/avatars/${u.avatar}?t=${encodeURIComponent(u.avatar)}`;
    }
    return '';
  }

  filteredUsers() {
    return this.users().filter(u => {
      const n = `${u.firstname} ${u.lastname} ${u.email}`.toLowerCase();
      const matchSearch = n.includes(this.searchTerm.toLowerCase());
      const matchRole = !this.roleFilter || this.roleName(u) === this.roleFilter;
      return matchSearch && matchRole;
    });
  }

  openCreate() {
    this.form = { firstname: '', lastname: '', email: '', password: '', role: 'Utilisateur' };
    this.editMode.set(false);
    this.editingId = null;
    this.showModal.set(true);
  }

  editUser(u: User) {
    this.form = { firstname: u.firstname, lastname: u.lastname, email: u.email, password: '', role: this.roleName(u) };
    this.editMode.set(true);
    this.editingId = u.id;
    this.showModal.set(true);
  }

  saveUser() {
    const payload = { ...this.form, username: this.form.email };
    const req = this.editMode()
      ? this.http.put(`http://127.0.0.1:5000/api/user/users/${this.editingId}`, payload)
      : this.http.post('http://127.0.0.1:5000/api/user/users', payload);
    req.subscribe({ next: () => { this.showModal.set(false); this.loadUsers(); }, error: e => console.error(e) });
  }

  deleteUser(id: number) {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    this.http.delete(`http://127.0.0.1:5000/api/user/users/${id}`).subscribe({ next: () => this.loadUsers() });
  }

  roleName(u: User): string { return typeof u.role === 'string' ? u.role : u.role?.name ?? ''; }
  initials(u: User): string {
    return (`${u.firstname?.[0] ?? ''}${u.lastname?.[0] ?? ''}`.toUpperCase()) || (u.username?.[0]?.toUpperCase() ?? '?');
  }
  roleBadge(role: string): string {
    if (role === 'Administrateur') return 'badge badge-admin';
    if (role.includes('juridique')) return 'badge badge-juri';
    return 'badge badge-user';
  }
}
