import { Component, computed, signal, ChangeDetectionStrategy } from '@angular/core';
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
  templateUrl: './dashboard-layout.component.html',
  styleUrls: ['./dashboard-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardLayoutComponent {
  /** Icon cache: computed once per nav item at construction, never recalculated */
  private readonly iconCache = new Map<string, SafeHtml>();
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
      roles: ['Administrateur', 'Responsable juridique']
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
    if (!this.iconCache.has(iconSvg)) {
      this.iconCache.set(iconSvg, this.sanitizer.bypassSecurityTrustHtml(iconSvg));
    }
    return this.iconCache.get(iconSvg)!;
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