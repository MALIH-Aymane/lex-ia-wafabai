import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

export interface UserQuestion {
  id: number;
  date?: string;
  texte: string;
  user: string;
  filters?: string;
  langue?: string;
  status: string; // 'NORMAL', 'SENT_TO_EXPERT', 'JURISPRUDENCE'
}

@Component({
  selector: 'app-my-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="user-requests-page">

  <!-- HERO HEADER -->
  <div class="hero-card card animate-fadeInUp">
    <div class="hero-content">
      <div class="hero-icon-box">📨</div>
      <div>
        <h2>Mes Demandes Juridiques</h2>
        <p>Consultez l'état de vos questions transmises aux experts et découvrez les réponses officielles.</p>
      </div>
    </div>

    <!-- STATS PILLS -->
    <div class="stats-row">
      <div class="stat-pill">
        <span class="stat-num">{{ pendingCount() }}</span>
        <span class="stat-label">En attente d'expert</span>
      </div>
      <div class="stat-pill">
        <span class="stat-num">{{ processedCount() }}</span>
        <span class="stat-label">Réponses validées</span>
      </div>
      <div class="stat-pill">
        <span class="stat-num">{{ questions().length }}</span>
        <span class="stat-label">Total sollicitations</span>
      </div>
    </div>
  </div>

  <!-- FILTER & SEARCH BAR -->
  <div class="filter-bar animate-fadeInUp">
    <div class="search-wrap">
      <svg class="search-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="text"
        class="search-input"
        placeholder="Rechercher dans mes demandes..."
        [(ngModel)]="searchQuery"
      />
    </div>

    <div class="status-tabs">
      <button class="tab-btn" [class.active]="activeTab() === 'PENDING'" (click)="activeTab.set('PENDING')">
        En attente ({{ pendingCount() }})
      </button>
      <button class="tab-btn" [class.active]="activeTab() === 'PROCESSED'" (click)="activeTab.set('PROCESSED')">
        Traitées ({{ processedCount() }})
      </button>
      <button class="tab-btn" [class.active]="activeTab() === 'ALL'" (click)="activeTab.set('ALL')">
        Toutes ({{ questions().length }})
      </button>
    </div>
  </div>

  <!-- LOADING STATE -->
  <div class="loading-state" *ngIf="loading()">
    <span class="spinner" style="width:40px; height:40px"></span>
    <h4>Chargement de vos demandes...</h4>
  </div>

  <!-- REQUESTS GRID -->
  <div class="requests-grid" *ngIf="!loading() && filteredQuestions().length > 0">
    <div class="request-card card card-hover animate-fadeInUp"
         *ngFor="let q of filteredQuestions(); let i = index"
         [style.animation-delay]="i * 0.05 + 's'">

      <div class="req-header">
        <div class="req-id-badge">Question #{{ q.id }}</div>
        <span class="badge" [class]="getStatusBadgeClass(q.status)">
          {{ formatStatusLabel(q.status) }}
        </span>
      </div>

      <div class="req-question">
        « {{ q.texte }} »
      </div>

      <div class="req-user-meta">
        <span class="date-chip">📅 {{ q.date || 'Récemment' }}</span>
        <button *ngIf="q.status === 'Sent to expert' || q.status === 'SENT_TO_EXPERT'"
                class="btn-delete-sm" 
                (click)="deleteQuestion(q.id)"
                title="Annuler cette demande">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          Supprimer
        </button>
      </div>

      <div class="req-actions" *ngIf="q.status === 'Jurisprudence' || q.status === 'JURISPRUDENCE'" style="margin-top: 10px;">
        <button class="btn btn-primary btn-sm btn-block" style="width: 100%;" (click)="viewResponse(q)">
          👁️ Consulter la réponse
        </button>
      </div>
    </div>
  </div>

  <!-- EMPTY STATE -->
  <div class="empty-state card" *ngIf="!loading() && filteredQuestions().length === 0">
    <div class="empty-icon">📂</div>
    <h3>Aucune demande trouvée</h3>
    <p>Vous n'avez soumis aucune question nécessitant l'avis d'un expert ou aucune demande ne correspond à votre recherche.</p>
  </div>
</div>
  `,
  styles: [`
    .user-requests-page { display: flex; flex-direction: column; gap: 20px; }

    /* HERO CARD */
    .hero-card {
      padding: 24px 28px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid var(--border-light);
      border-radius: 16px;
    }
    .hero-content { display: flex; align-items: center; gap: 16px; }
    .hero-icon-box {
      width: 48px; height: 48px; border-radius: 12px;
      background: rgba(10,31,78,0.08); display: flex;
      align-items: center; justify-content: center; font-size: 26px;
    }
    .hero-content h2 { font-size: 22px; font-weight: 700; color: var(--navy); margin-bottom: 4px; }
    .hero-content p { font-size: 13.5px; color: var(--text-muted); margin: 0; }

    /* STATS ROW */
    .stats-row { display: flex; gap: 14px; flex-wrap: wrap; }
    .stat-pill {
      background: rgba(10,31,78,0.04); border: 1px solid rgba(10,31,78,0.08);
      padding: 10px 18px; border-radius: 12px; display: flex; align-items: center; gap: 10px;
    }
    .stat-num { font-size: 20px; font-weight: 800; color: var(--primary-dark, #c8842a); }
    .stat-label { font-size: 12.5px; font-weight: 600; color: var(--navy); }

    /* FILTER BAR */
    .filter-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; }
    .search-wrap { position: relative; flex: 1; min-width: 260px; }
    .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
    .search-input {
      width: 100%; padding: 10px 14px 10px 42px; border: 1.5px solid var(--border-light);
      border-radius: 10px; font-size: 13.5px; outline: none; transition: border-color 0.2s;
    }
    .search-input:focus { border-color: var(--primary); }

    .status-tabs { display: flex; gap: 4px; background: #e2e8f0; padding: 3px; border-radius: 8px; }
    .tab-btn {
      padding: 6px 14px; border: none; background: transparent; font-size: 12.5px;
      font-weight: 600; color: var(--text-muted); border-radius: 6px; cursor: pointer; transition: all 0.15s;
    }
    .tab-btn.active { background: #ffffff; color: var(--navy); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

    /* GRID & CARDS */
    .requests-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;
    }
    @media (max-width: 1100px) { .requests-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 700px)  { .requests-grid { grid-template-columns: 1fr; } }

    .request-card {
      padding: 20px; display: flex; flex-direction: column; gap: 14px;
      border: 1.5px solid var(--border-light); border-radius: 14px; background: #ffffff;
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    }
    .request-card:hover {
      transform: translateY(-2px); box-shadow: 0 10px 25px rgba(10,31,78,0.08);
      border-color: var(--primary);
    }
    .req-header { display: flex; align-items: center; justify-content: space-between; }
    .req-id-badge { font-size: 12px; font-weight: 800; color: var(--navy); background: rgba(10,31,78,0.06); padding: 3px 8px; border-radius: 6px; }

    .req-question {
      font-size: 14.5px; font-weight: 700; color: var(--navy); line-height: 1.45;
      flex: 1; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }

    .req-user-meta { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-muted); border-top: 1px solid var(--border-light); padding-top: 10px; }
    .btn-delete-sm {
      display: flex; align-items: center; gap: 4px; background: transparent;
      border: none; color: #ef4444; font-size: 12px; font-weight: 600;
      cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: all 0.2s;
    }
    .btn-delete-sm:hover { background: rgba(239, 68, 68, 0.1); }

    .badge-pending { background: rgba(245,158,11,.15); color: #92400e; }
    .badge-processed { background: rgba(16,185,129,.15); color: #065f46; }
    .badge-normal { background: rgba(107,114,128,.1); color: #374151; }

    .empty-state { text-align: center; padding: 70px 20px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .empty-icon { font-size: 50px; }
    .empty-state h3 { color: var(--navy); margin: 0; }
    .empty-state p { color: var(--text-muted); font-size: 13.5px; margin: 0; max-width: 420px; }
  `]
})
export class MyRequestsComponent implements OnInit {
  questions = signal<UserQuestion[]>([]);
  loading = signal(false);
  searchQuery = '';
  activeTab = signal<'PENDING' | 'PROCESSED' | 'ALL'>('ALL');

  constructor(private http: HttpClient, private auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.loadQuestions();
  }

  loadQuestions() {
    this.loading.set(true);
    const token = this.auth.token() || localStorage.getItem('lex_token') || '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    // We fetch questions with status SENT_TO_EXPERT or JURISPRUDENCE for the current user
    this.http.get<any>(`${environment.apiUrl}/api/question/users/questions/by-status?status=SENT_TO_EXPERT,JURISPRUDENCE`, { headers }).subscribe({
      next: (res) => {
        const items = Array.isArray(res) ? res : (res.questions || []);
        this.questions.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erreur chargement des demandes:', err);
        this.questions.set([]);
        this.loading.set(false);
      }
    });
  }

  pendingCount(): number {
    return this.questions().filter(q => q.status === 'Sent to expert' || q.status === 'SENT_TO_EXPERT').length;
  }

  processedCount(): number {
    return this.questions().filter(q => q.status === 'Jurisprudence' || q.status === 'JURISPRUDENCE').length;
  }

  filteredQuestions(): UserQuestion[] {
    let list = this.questions();
    const tab = this.activeTab();

    if (tab === 'PENDING') {
      list = list.filter(q => q.status === 'Sent to expert' || q.status === 'SENT_TO_EXPERT');
    } else if (tab === 'PROCESSED') {
      list = list.filter(q => q.status === 'Jurisprudence' || q.status === 'JURISPRUDENCE');
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(item =>
        (item.texte && item.texte.toLowerCase().includes(q))
      );
    }

    return list;
  }

  formatStatusLabel(status: string): string {
    if (status === 'Sent to expert' || status === 'SENT_TO_EXPERT') return 'En cours de traitement';
    if (status === 'Jurisprudence' || status === 'JURISPRUDENCE') return 'Réponse validée';
    return status || 'Normale';
  }

  getStatusBadgeClass(status: string): string {
    if (status === 'Sent to expert' || status === 'SENT_TO_EXPERT') return 'badge badge-pending';
    if (status === 'Jurisprudence' || status === 'JURISPRUDENCE') return 'badge badge-processed';
    return 'badge badge-normal';
  }

  deleteQuestion(id: number) {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette demande ?')) return;
    
    const token = this.auth.token() || localStorage.getItem('lex_token') || '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.delete(`${environment.apiUrl}/api/question/question/${id}`, { headers }).subscribe({
      next: () => {
        this.questions.update(list => list.filter(q => q.id !== id));
      },
      error: (err) => {
        console.error('Erreur lors de la suppression:', err);
        alert('Une erreur est survenue lors de la suppression de la demande.');
      }
    });
  }

  viewResponse(q: UserQuestion) {
    this.router.navigate(['/dashboard/jurisprudence'], { queryParams: { q: q.texte } });
  }
}
