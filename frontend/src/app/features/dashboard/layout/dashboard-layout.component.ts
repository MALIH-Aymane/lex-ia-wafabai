import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles: string[];
}

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
<div class="layout" [class.sidebar-collapsed]="collapsed()">

  <!-- ── SIDEBAR ─────────────────────────────────────── -->
  <aside class="sidebar">
    <div class="sidebar-header">
      <a routerLink="/dashboard/home" class="logo-link" title="Accueil Tableau de bord">
        <img src="assets/logo.png" alt="LEX-IA" class="sidebar-logo" />
        <span class="sidebar-brand" *ngIf="!collapsed()">LEX<span class="ia">-IA</span></span>
      </a>
      <button class="collapse-btn" (click)="toggleSidebar()" title="Réduire">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path *ngIf="!collapsed()" d="M15 19l-7-7 7-7"/>
          <path *ngIf="collapsed()" d="M9 5l7 7-7 7"/>
        </svg>
      </button>
    </div>

    <nav class="sidebar-nav">
      <ng-container *ngFor="let item of visibleNav()">
        <a class="nav-item"
           [routerLink]="item.path"
           routerLinkActive="active"
           [title]="collapsed() ? item.label : ''">
          <span class="nav-icon" [innerHTML]="getSafeIcon(item.icon)"></span>
          <span class="nav-label" *ngIf="!collapsed()">{{ item.label }}</span>
        </a>
      </ng-container>
    </nav>

    <div class="sidebar-footer">
      <a class="nav-item" routerLink="/dashboard/profile" routerLinkActive="active" [title]="collapsed() ? 'Profil' : ''">
        <img *ngIf="avatarUrl()" [src]="avatarUrl()" class="user-avatar-img" alt="Avatar" />
        <div *ngIf="!avatarUrl()" class="user-avatar">{{ initials() }}</div>
        <div class="user-info" *ngIf="!collapsed()">
          <span class="user-name">{{ fullName() }}</span>
          <span class="user-role">{{ roleName() }}</span>
        </div>
      </a>
      <button class="logout-btn" (click)="logout()" [title]="collapsed() ? 'Déconnexion' : ''">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span *ngIf="!collapsed()">Déconnexion</span>
      </button>
    </div>
  </aside>

  <!-- ── MAIN AREA ───────────────────────────────────── -->
  <div class="main-area">
    <!-- Topbar -->
    <header class="topbar">
      <button class="mobile-menu-btn" (click)="toggleSidebar()">
        <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div class="topbar-title-wrap">
        <div class="topbar-title">{{ pageTitle().title }}</div>
        <div class="topbar-subtitle" *ngIf="pageTitle().subtitle">{{ pageTitle().subtitle }}</div>
      </div>
      <div class="topbar-actions">
        <a routerLink="/dashboard/profile" class="topbar-user-avatar" title="Mon Profil">
          <img *ngIf="avatarUrl()" [src]="avatarUrl()" class="topbar-avatar-img" alt="Avatar" />
          <div *ngIf="!avatarUrl()" class="topbar-avatar-initials">{{ initials() }}</div>
        </a>
        <div class="role-badge-top" [class]="'role-' + roleClass()">{{ roleName() }}</div>
      </div>
    </header>

    <!-- Content -->
    <main class="main-content">
      <router-outlet></router-outlet>
    </main>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    /* LAYOUT */
    .layout { display: flex; min-height: 100vh; --sw: 260px; }
    .layout.sidebar-collapsed { --sw: 72px; }

    /* SIDEBAR */
    .sidebar {
      width: var(--sw); height: 100vh; position: fixed; top: 0; left: 0; z-index: 200;
      background: var(--navy-dark); color: #fff;
      display: flex; flex-direction: column;
      transition: width .25s cubic-bezier(.4,0,.2,1);
      box-shadow: 4px 0 24px rgba(0,0,0,.25);
    }

    .sidebar-header {
      height: var(--topbar-h); padding: 0 16px;
      display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      flex-shrink: 0;
    }
    .logo-link {
      display: flex; align-items: center; gap: 10px; text-decoration: none; cursor: pointer; flex-shrink: 0;
      transition: opacity .2s;
    }
    .logo-link:hover { opacity: .88; }
    .sidebar-logo { width: 32px; height: 32px; object-fit: contain; }
    .sidebar-brand {
      font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700;
      letter-spacing: 1px; color: #fff; white-space: nowrap;
    }
    .sidebar-brand .ia { color: #ff7a00; }

    .collapse-btn {
      margin-left: auto; background: rgba(255,255,255,.08); border: none;
      color: rgba(255,255,255,.6); width: 28px; height: 28px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
      transition: all .2s;
    }
    .collapse-btn:hover { background: rgba(255,255,255,.15); color: #fff; }

    .sidebar-nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; overflow-x: hidden; }

    /* PROFESSIONAL NAV ITEMS WITH ORANGE ACCENTS */
    .nav-item {
      display: flex; align-items: center; gap: 12px;
      padding: 9px 12px; border-radius: 10px;
      color: rgba(255,255,255,.7); font-size: 13.5px; font-weight: 500;
      transition: all .2s ease; cursor: pointer; white-space: nowrap; text-decoration: none;
      border-left: 3.5px solid transparent;
    }
    .nav-item:hover {
      background: rgba(255,255,255,.07); color: #ffffff;
    }
    .nav-item:hover .nav-icon {
      background: rgba(249, 115, 22, 0.22);
      color: #ff8c1a;
      transform: scale(1.08);
    }
    .nav-item.active {
      background: linear-gradient(135deg, rgba(249, 115, 22, 0.18) 0%, rgba(234, 88, 12, 0.28) 100%);
      color: #ffffff; font-weight: 600;
      border-left-color: #ff7a00;
      box-shadow: 0 4px 14px rgba(249, 115, 22, 0.2);
    }
    .nav-item.active .nav-icon {
      background: #ff7a00;
      color: #ffffff;
      box-shadow: 0 3px 10px rgba(249, 115, 22, 0.45);
      transform: scale(1.05);
    }

    /* ORANGE ICON STYLING */
    .nav-icon {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 8px;
      background: rgba(249, 115, 22, 0.12);
      color: #ff7a00; flex-shrink: 0;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(249, 115, 22, 0.12);
    }
    .nav-icon ::ng-deep svg { width: 17px; height: 17px; stroke-width: 2; display: block; }
    .nav-label { overflow: hidden; text-overflow: ellipsis; }

    .sidebar-footer { padding: 8px; border-top: 1px solid rgba(255,255,255,.08); display: flex; flex-direction: column; gap: 2px; }
    .user-avatar {
      width: 36px; height: 36px; border-radius: 50%; background: #ff7a00;
      color: #fff; font-size: 13px; font-weight: 700; display: flex;
      align-items: center; justify-content: center; flex-shrink: 0;
    }
    .user-avatar-img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,.2); flex-shrink: 0; }

    .topbar-user-avatar { display: flex; align-items: center; cursor: pointer; text-decoration: none; transition: transform .15s; }
    .topbar-user-avatar:hover { transform: scale(1.05); }
    .topbar-avatar-img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid #ff7a00; }
    .topbar-avatar-initials {
      width: 34px; height: 34px; border-radius: 50%; background: #ff7a00; color: #fff;
      display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
    }
    .user-info { display: flex; flex-direction: column; overflow: hidden; }
    .user-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role { font-size: 11px; color: rgba(255,255,255,.45); white-space: nowrap; }
    .logout-btn {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 10px; border: none;
      background: transparent; color: rgba(255,255,255,.5); cursor: pointer;
      font-size: 14px; font-weight: 500; width: 100%; transition: all .18s;
    }
    .logout-btn:hover { background: rgba(239,68,68,.15); color: #f87171; }

    /* MAIN */
    .main-area {
      flex: 1; margin-left: var(--sw);
      display: flex; flex-direction: column; min-height: 100vh;
      transition: margin-left .25s cubic-bezier(.4,0,.2,1);
    }

    /* TOPBAR */
    .topbar {
      height: var(--topbar-h); background: var(--bg-white);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 16px;
      padding: 0 24px; position: sticky; top: 0; z-index: 100;
      box-shadow: var(--shadow-sm);
    }
    .mobile-menu-btn { display: none; background: none; border: none; cursor: pointer; color: var(--text); padding: 4px; }
    @media (max-width: 768px) { .mobile-menu-btn { display: flex; } }
    .topbar-title-wrap { display: flex; flex-direction: column; gap: 1px; }
    .topbar-title { font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 600; color: var(--navy); line-height: 1.2; }
    .topbar-subtitle { font-size: 11px; color: var(--text-muted); font-weight: 400; }
    .topbar-actions { margin-left: auto; display: flex; align-items: center; gap: 12px; }

    .role-badge-top {
      padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600;
    }
    .role-Administrateur { background: rgba(10,31,78,.1); color: var(--navy); }
    .role-Responsable { background: rgba(249, 115, 22, 0.12); color: #ea580c; }
    .role-Utilisateur { background: rgba(59,130,246,.1); color: #1d4ed8; }

    /* CONTENT */
    .main-content { flex: 1; padding: 28px; background: var(--bg); }

    @media (max-width: 768px) {
      .sidebar { transform: translateX(-100%); }
      .sidebar-collapsed .sidebar, .sidebar { transform: translateX(0); }
      .main-area { margin-left: 0 !important; }
    }
  `]
})
export class DashboardLayoutComponent {
  collapsed = signal(false);

  navItems: NavItem[] = [
    {
      label: 'Tableau de bord',
      path: '/dashboard/home',
      icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      roles: ['Administrateur', 'Responsable juridique', 'Utilisateur']
    },
    {
      label: 'Recherche',
      path: '/dashboard/search',
      icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      roles: ['Administrateur', 'Responsable juridique', 'Utilisateur']
    },
    {
      label: 'Historique',
      path: '/dashboard/history',
      icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 16 14"/></svg>',
      roles: ['Administrateur', 'Responsable juridique', 'Utilisateur']
    },
    {
      label: 'Jurisprudence',
      path: '/dashboard/jurisprudence',
      icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h18"/></svg>',
      roles: ['Administrateur', 'Responsable juridique', 'Utilisateur']
    },
    {
      label: 'Mes Demandes',
      path: '/dashboard/my-requests',
      icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
      roles: ['Administrateur', 'Responsable juridique', 'Utilisateur']
    },
    {
      label: 'Demandes Utilisateurs',
      path: '/dashboard/user-requests',
      icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
      roles: ['Administrateur', 'Responsable juridique']
    },
    {
      label: 'Utilisateurs',
      path: '/dashboard/users',
      icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      roles: ['Administrateur']
    },
    {
      label: 'Documents',
      path: '/dashboard/documents',
      icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      roles: ['Administrateur']
    },
    {
      label: 'Groupings',
      path: '/dashboard/groupings',
      icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>',
      roles: ['Administrateur']
    },
    {
      label: 'Gestion BD',
      path: '/dashboard/db-manager',
      icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
      roles: ['Administrateur']
    },
    {
      label: 'Modèles LLM',
      path: '/dashboard/llm-models',
      icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 8h2M11 8h2M15 8h2M7 12h2M11 12h2M15 12h2"/></svg>',
      roles: ['Administrateur']
    },
  ];

  visibleNav = computed(() => {
    const role = this.auth.getRoleName();
    return this.navItems.filter(n => n.roles.includes(role));
  });

  roleName = computed(() => this.auth.getRoleName());
  roleClass = computed(() => this.auth.getRoleName().split(' ')[0]);
  avatarUrl = computed(() => this.auth.getAvatarUrl());

  fullName = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return '';
    return `${u.firstname} ${u.lastname}`.trim();
  });

  initials = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return 'U';
    return `${u.firstname?.[0] || ''}${u.lastname?.[0] || ''}`.toUpperCase();
  });

  pageTitle = signal<{ title: string; subtitle?: string }>({ title: 'Tableau de bord' });

  constructor(
    private auth: AuthService,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {
    this.updateTitle(this.router.url);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.updateTitle(e.urlAfterRedirects);
    });
  }

  getSafeIcon(iconSvg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(iconSvg);
  }

  toggleSidebar() {
    this.collapsed.set(!this.collapsed());
  }

  logout() {
    this.auth.logout();
  }

  private updateTitle(url: string) {
    if (url.includes('/home')) this.pageTitle.set({ title: 'Tableau de Bord', subtitle: 'Aperçu général de la plateforme' });
    else if (url.includes('/search')) this.pageTitle.set({ title: 'Recherche Juridique', subtitle: 'Recherche sémantique dans les textes de loi et circulaires BAM' });
    else if (url.includes('/history')) this.pageTitle.set({ title: 'Historique de Recherche', subtitle: 'Consultez vos requêtes et filtres précédents' });
    else if (url.includes('/jurisprudence')) this.pageTitle.set({ title: 'Base de Jurisprudence', subtitle: 'Décisions de justice et jurisprudence marocaine' });
    else if (url.includes('/my-requests')) this.pageTitle.set({ title: 'Mes Demandes', subtitle: 'Suivi de vos questions transmises aux experts' });
    else if (url.includes('/user-requests')) this.pageTitle.set({ title: 'Demandes Utilisateurs', subtitle: 'Questions transmises par les utilisateurs au Responsable Juridique' });
    else if (url.includes('/users')) this.pageTitle.set({ title: 'Gestion des Utilisateurs', subtitle: 'Administration des comptes et rôles' });
    else if (url.includes('/documents')) this.pageTitle.set({ title: 'Gestion des Documents', subtitle: 'Base de connaissances et documents juridiques' });
    else if (url.includes('/groupings')) this.pageTitle.set({ title: 'Gestionnaire des Groupings', subtitle: 'Organisation et hiérarchie des groupes de documents' });
    else if (url.includes('/db-manager')) this.pageTitle.set({ title: 'Gestionnaire Vectoriel ChromaDB', subtitle: 'Collections, vecteurs et métadonnées juridiques' });
    else if (url.includes('/llm-models')) this.pageTitle.set({ title: 'Modèles LLM', subtitle: 'Configuration et gestion des fournisseurs d\'Intelligence Artificielle' });
    else if (url.includes('/profile')) this.pageTitle.set({ title: 'Mon Profil', subtitle: 'Informations personnelles et sécurité' });
  }
}
