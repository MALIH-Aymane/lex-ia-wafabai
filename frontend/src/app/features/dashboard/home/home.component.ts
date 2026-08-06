import { Component, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';

interface StatItem {
  icon: string;
  color: string;
  value: string;
  label: string;
  trend: number;
}

interface ActivityItem {
  type: string;
  title: string;
  time: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  firstName = computed(() => {
    const u = this.auth.currentUser();
    return u?.firstname ?? u?.username ?? 'Utilisateur';
  });

  isJuriste = computed(() => this.auth.getRoleName() === 'Responsable juridique');

  /** Stats for default (admin / user) dashboard */
  stats: StatItem[] = [
    { icon: '🔍', color: 'teal',   value: '0',    label: 'Recherches enregistrées', trend: 0 },
    { icon: '📄', color: 'navy',   value: '0',    label: 'Documents indexés',        trend: 5 },
    { icon: '⚖️', color: 'amber',  value: '0',    label: 'Jurisprudences publiées',  trend: 0 },
    { icon: '🧠', color: 'purple', value: '98.5%', label: 'Précision sémantique',   trend: 2 },
  ];

  /** Stats for Responsable Juridique dashboard */
  juristeStats: StatItem[] = [
    { icon: '⚖️', color: 'orange', value: '0', label: 'Jurisprudences publiées',    trend: 0 },
    { icon: '🔍', color: 'teal',   value: '0', label: 'Recherches effectuées',       trend: 0 },
    { icon: '📜', color: 'navy',   value: '0', label: 'Documents consultés',         trend: 0 },
    { icon: '✅', color: 'amber',  value: '0', label: 'Validations réalisées',       trend: 2 },
  ];

  recentActivity: ActivityItem[] = [];

  quickActions = computed(() => {
    const role = this.auth.getRoleName();
    const base = [
      { icon: '🔍', color: 'teal',   title: 'Recherche sémantique', desc: 'Interrogez la base légale',    path: '/dashboard/search' },
      { icon: '👤', color: 'navy',   title: 'Mon profil',           desc: 'Gérez vos informations',       path: '/dashboard/profile' },
    ];
    if (role === 'Administrateur') {
      base.splice(1, 0, { icon: '⚖️', color: 'purple', title: 'Jurisprudence',  desc: 'Gérez les réponses juridiques', path: '/dashboard/jurisprudence' });
      base.push({ icon: '👥', color: 'amber', title: 'Utilisateurs', desc: 'Administrez les comptes', path: '/dashboard/users' });
    }
    return base;
  });

  constructor(private auth: AuthService, private http: HttpClient) {}

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.http.get<any>('http://127.0.0.1:5000/api/dashboard/stats').subscribe({
      next: (res) => {
        if (res.questions) {
          this.stats[0].value = String(res.questions.total || 0);
          this.juristeStats[1].value = String(res.questions.total || 0);
        }
        if (res.documents) {
          this.stats[1].value = String(res.documents.total || 0);
          this.juristeStats[2].value = String(res.documents.total || 0);
        }
        if (res.jurisprudences) {
          this.stats[2].value = String(res.jurisprudences.total || 0);
          this.juristeStats[0].value = String(res.jurisprudences.total || 0);
        }
        if (res.recent_activity) {
          this.recentActivity = res.recent_activity;
        }
      },
      error: () => {}
    });
  }
}
