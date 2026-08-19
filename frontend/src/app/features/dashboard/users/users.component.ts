import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface User { id: number; username: string; email: string; firstname: string; lastname: string; role: any; is_blocked: boolean; avatar?: string; }

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
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
    this.http.get<User[]>(`${environment.apiUrl}/api/user/users`).subscribe({
      next: u => this.users.set(u), error: () => {}
    });
  }

  getAvatarUrl(u: User): string {
    if (u && u.avatar) {
      return `${environment.apiUrl}/api/user/avatars/${u.avatar}?t=${encodeURIComponent(u.avatar)}`;
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
      ? this.http.put(`${environment.apiUrl}/api/user/users/${this.editingId}`, payload)
      : this.http.post(`${environment.apiUrl}/api/user/users`, payload);
    req.subscribe({ next: () => { this.showModal.set(false); this.loadUsers(); }, error: e => console.error(e) });
  }

  deleteUser(id: number) {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    this.http.delete(`${environment.apiUrl}/api/user/users/${id}`).subscribe({ next: () => this.loadUsers() });
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
