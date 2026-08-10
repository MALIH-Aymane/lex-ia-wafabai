import { Component, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

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
  template: `
<div class="home-page">

  <!-- ═══════════════════════════════════════════════
       RESPONSABLE JURIDIQUE DASHBOARD
  ═══════════════════════════════════════════════ -->
  <ng-container *ngIf="isJuriste()">

    <!-- Legal Welcome Banner -->
    <div class="welcome-banner legal-banner animate-fadeInUp">
      <div class="orb orb-w1"></div>
      <div class="orb orb-w2"></div>
      <div class="welcome-content">
        <div class="welcome-text">
          <div class="role-badge">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10M12 3v18M3 7h18"/></svg>
            Responsable Juridique
          </div>
          <h1>Bonjour, {{ firstName() }} 👨‍⚖️</h1>
          <p>Bienvenue sur votre espace juridique <strong>LEX-IA</strong>.<br>Gérez, validez et publiez vos réponses de jurisprudence.</p>
        </div>
        <div class="banner-actions">
          <a routerLink="/dashboard/jurisprudence" class="btn btn-primary btn-lg">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10M12 3v18M3 7h18"/></svg>
            Gérer la Jurisprudence
          </a>
          <a routerLink="/dashboard/search" class="btn btn-outline-light btn-lg">
            🔍 Nouvelle Recherche
          </a>
        </div>
      </div>
    </div>

    <!-- Legal Stats -->
    <div class="stats-row animate-fadeInUp" style="animation-delay:.08s">
      <div class="stat-card stat-card-legal" *ngFor="let s of juristeStats">
        <div class="stat-icon" [class]="'si-' + s.color">{{ s.icon }}</div>
        <div class="stat-body">
          <div class="stat-val">{{ s.value }}</div>
          <div class="stat-lbl">{{ s.label }}</div>
        </div>
        <div class="stat-trend" [class.up]="s.trend > 0" [class.down]="s.trend < 0" *ngIf="s.trend !== 0">
          <svg *ngIf="s.trend > 0" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>
          <svg *ngIf="s.trend < 0" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
          {{ s.trend > 0 ? '+' : '' }}{{ s.trend }}%
        </div>
      </div>
    </div>

    <!-- Legal Quick Panels -->
    <div class="content-grid animate-fadeInUp" style="animation-delay:.16s">
      <!-- Legal Quick Actions -->
      <div class="card">
        <div class="card-header">
          <h3>⚖️ Espace Juridique</h3>
          <span class="badge badge-legal">Expert</span>
        </div>
        <div class="quick-actions">
          <a class="quick-action quick-action-legal" routerLink="/dashboard/jurisprudence">
            <div class="qa-icon qa-legal">⚖️</div>
            <div class="qa-body">
              <div class="qa-title">Base de Jurisprudence</div>
              <div class="qa-desc">Valider, créer et publier des décisions</div>
            </div>
            <svg class="qa-arrow" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          <a class="quick-action" routerLink="/dashboard/search">
            <div class="qa-icon qa-teal">🔍</div>
            <div class="qa-body">
              <div class="qa-title">Recherche Sémantique</div>
              <div class="qa-desc">Interroger la base légale marocaine</div>
            </div>
            <svg class="qa-arrow" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          <a class="quick-action" routerLink="/dashboard/history">
            <div class="qa-icon qa-navy">📜</div>
            <div class="qa-body">
              <div class="qa-title">Historique des Requêtes</div>
              <div class="qa-desc">Consultez vos recherches précédentes</div>
            </div>
            <svg class="qa-arrow" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          <a class="quick-action" routerLink="/dashboard/profile">
            <div class="qa-icon qa-amber">👤</div>
            <div class="qa-body">
              <div class="qa-title">Mon Profil</div>
              <div class="qa-desc">Gérer vos informations personnelles</div>
            </div>
            <svg class="qa-arrow" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>

      <!-- Legal Activity + Scope Info -->
      <div class="card">
        <div class="card-header">
          <h3>Activité récente</h3>
          <span class="badge badge-teal">En direct</span>
        </div>
        <div class="activity-list">
          <div class="activity-item" *ngFor="let a of recentActivity">
            <div class="activity-dot" [class]="'dot-' + a.type"></div>
            <div class="activity-body">
              <div class="activity-title">{{ a.title }}</div>
              <div class="activity-time">{{ a.time }}</div>
            </div>
          </div>
          <div class="empty-activity" *ngIf="!recentActivity.length">
            <span>Aucune activité récente.</span>
          </div>
        </div>

        <!-- Legal Scope Notice -->
        <div class="scope-notice">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <span>Votre accès inclut : Recherche, Jurisprudence, Historique. Pour l'administration des documents et groupings, contactez un Administrateur.</span>
        </div>
      </div>
    </div>

  </ng-container>

  <!-- ═══════════════════════════════════════════════
       ADMIN / UTILISATEUR DASHBOARD (DEFAULT)
  ═══════════════════════════════════════════════ -->
  <ng-container *ngIf="!isJuriste()">

    <!-- Welcome banner -->
    <div class="welcome-banner bg-network animate-fadeInUp">
      <div class="orb orb-w1"></div>
      <div class="welcome-content">
        <div class="welcome-text">
          <h1>Bonjour, {{ firstName() }} 👋</h1>
          <p>Bienvenue sur <strong>LEX-IA</strong> — votre assistant juridique intelligent.<br>Que recherchez-vous aujourd'hui&nbsp;?</p>
        </div>
        <a routerLink="/dashboard/search" class="btn btn-primary btn-lg">
          Nouvelle recherche
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row animate-fadeInUp" style="animation-delay:.08s">
      <div class="stat-card" *ngFor="let s of stats">
        <div class="stat-icon" [class]="'si-' + s.color">{{ s.icon }}</div>
        <div class="stat-body">
          <div class="stat-val">{{ s.value }}</div>
          <div class="stat-lbl">{{ s.label }}</div>
        </div>
        <div class="stat-trend" [class.up]="s.trend > 0" [class.down]="s.trend < 0" *ngIf="s.trend !== 0">
          <svg *ngIf="s.trend > 0" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>
          <svg *ngIf="s.trend < 0" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
          {{ s.trend > 0 ? '+' : '' }}{{ s.trend }}%
        </div>
      </div>
    </div>

    <!-- Quick actions + Recent activity -->
    <div class="content-grid animate-fadeInUp" style="animation-delay:.16s">
      <!-- Quick Actions -->
      <div class="card">
        <div class="card-header">
          <h3>Actions rapides</h3>
        </div>
        <div class="quick-actions">
          <a class="quick-action" *ngFor="let a of quickActions()" [routerLink]="a.path">
            <div class="qa-icon" [class]="'qa-' + a.color">{{ a.icon }}</div>
            <div class="qa-body">
              <div class="qa-title">{{ a.title }}</div>
              <div class="qa-desc">{{ a.desc }}</div>
            </div>
            <svg class="qa-arrow" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="card">
        <div class="card-header">
          <h3>Activité récente</h3>
          <span class="badge badge-teal">En direct</span>
        </div>
        <div class="activity-list">
          <div class="activity-item" *ngFor="let a of recentActivity">
            <div class="activity-dot" [class]="'dot-' + a.type"></div>
            <div class="activity-body">
              <div class="activity-title">{{ a.title }}</div>
              <div class="activity-time">{{ a.time }}</div>
            </div>
          </div>
          <div class="empty-activity" *ngIf="!recentActivity.length">
            <span>Aucune activité récente.</span>
          </div>
        </div>
      </div>
    </div>

  </ng-container>

</div>
  `,
  styles: [`
    .home-page { display: flex; flex-direction: column; gap: 24px; }

    /* ── Welcome Banner (default) ───────────────────── */
    .welcome-banner { border-radius: 20px; padding: 36px 40px; position: relative; overflow: hidden; }
    .orb-w1 { position: absolute; width: 300px; height: 300px; border-radius: 50%; background: rgba(0,205,182,.15); filter: blur(60px); right: -60px; top: -60px; pointer-events: none; }
    .welcome-content { display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; position: relative; z-index: 1; }
    .welcome-text h1 { font-size: 28px; color: #fff; margin-bottom: 8px; }
    .welcome-text p { font-size: 15px; color: rgba(255,255,255,.7); line-height: 1.6; }
    .welcome-text strong { color: #ff7a00; }

    /* ── Legal Banner ────────────────────────────────── */
    .legal-banner {
      background: linear-gradient(135deg, #0a1f4e 0%, #0d2f6b 50%, #1a3a7a 100%) !important;
      border: 1px solid rgba(255,255,255,.08);
    }
    .orb-w2 { position: absolute; width: 220px; height: 220px; border-radius: 50%; background: rgba(255,122,0,.12); filter: blur(60px); left: -40px; bottom: -40px; pointer-events: none; }
    .role-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 14px; background: rgba(255,122,0,.2); border: 1px solid rgba(255,122,0,.4);
      border-radius: 99px; font-size: 12px; font-weight: 700; color: #ff9a3c;
      margin-bottom: 12px;
    }
    .banner-actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn-outline-light {
      background: rgba(255,255,255,.08); border: 1.5px solid rgba(255,255,255,.3);
      color: #fff; padding: 12px 22px; border-radius: 12px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all .2s; text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
    }
    .btn-outline-light:hover { background: rgba(255,255,255,.15); }

    /* ── Stats ───────────────────────────────────────── */
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .stat-card {
      background: var(--bg-white); border-radius: var(--radius-lg); padding: 20px 24px;
      border: 1px solid var(--border); display: flex; align-items: center; gap: 16px;
      box-shadow: var(--shadow-sm); transition: var(--transition);
    }
    .stat-card:hover { box-shadow: var(--shadow); transform: translateY(-2px); }
    .stat-card-legal { border-left: 3px solid #ff7a00; }
    .stat-icon { font-size: 28px; width: 52px; height: 52px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .si-teal   { background: rgba(0,166,147,.1); }
    .si-navy   { background: rgba(10,31,78,.08); }
    .si-amber  { background: rgba(245,158,11,.1); }
    .si-purple { background: rgba(99,102,241,.1); }
    .si-orange { background: rgba(255,122,0,.1); }
    .stat-body { flex: 1; }
    .stat-val { font-size: 24px; font-weight: 700; color: var(--navy); font-family: 'Playfair Display', serif; }
    .stat-lbl { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .stat-trend { font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 2px; }
    .stat-trend.up { color: var(--success); }
    .stat-trend.down { color: var(--danger); }

    /* ── Content Grid ────────────────────────────────── */
    .content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .card-header h3 { font-size: 16px; color: var(--navy); }

    /* ── Quick Actions ───────────────────────────────── */
    .quick-actions { display: flex; flex-direction: column; gap: 10px; }
    .quick-action {
      display: flex; align-items: center; gap: 14px;
      padding: 14px; border-radius: var(--radius); border: 1px solid var(--border-light);
      transition: var(--transition); cursor: pointer; text-decoration: none;
    }
    .quick-action:hover { background: var(--bg); border-color: rgba(0,166,147,.3); transform: translateX(4px); }
    .quick-action-legal { border-color: rgba(255,122,0,.25); background: rgba(255,122,0,.03); }
    .quick-action-legal:hover { background: rgba(255,122,0,.08) !important; border-color: rgba(255,122,0,.5) !important; }
    .qa-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
    .qa-teal   { background: rgba(0,166,147,.1); }
    .qa-navy   { background: rgba(10,31,78,.08); }
    .qa-purple { background: rgba(99,102,241,.1); }
    .qa-amber  { background: rgba(245,158,11,.1); }
    .qa-legal  { background: rgba(255,122,0,.12); }
    .qa-body { flex: 1; }
    .qa-title { font-size: 14px; font-weight: 600; color: var(--text); }
    .qa-desc  { font-size: 12px; color: var(--text-muted); }
    .qa-arrow { color: var(--text-light); flex-shrink: 0; }

    /* ── Activity ────────────────────────────────────── */
    .activity-list { display: flex; flex-direction: column; gap: 14px; }
    .activity-item { display: flex; align-items: flex-start; gap: 12px; }
    .activity-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
    .dot-search { background: var(--primary); }
    .dot-juri   { background: var(--navy); }
    .dot-doc    { background: var(--warning); }
    .dot-user   { background: var(--info); }
    .activity-title { font-size: 13px; font-weight: 500; color: var(--text); }
    .activity-time  { font-size: 11px; color: var(--text-light); margin-top: 2px; }
    .empty-activity { text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0; }

    /* ── Scope Notice ────────────────────────────────── */
    .scope-notice {
      margin-top: 20px; display: flex; align-items: flex-start; gap: 8px;
      padding: 12px 14px; background: rgba(10,31,78,.05); border: 1px solid rgba(10,31,78,.1);
      border-radius: 10px; font-size: 12px; color: #6c757d; line-height: 1.5;
    }
    .scope-notice svg { flex-shrink: 0; margin-top: 2px; color: #0a1f4e; }

    /* ── Badges ──────────────────────────────────────── */
    .badge-legal { background: rgba(255,122,0,.15); color: #ff7a00; border: 1px solid rgba(255,122,0,.3); padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; }
  `]
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
    this.http.get<any>(`${environment.apiUrl}/api/dashboard/stats`).subscribe({
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
