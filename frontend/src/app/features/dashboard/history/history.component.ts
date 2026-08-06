import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

export interface QuestionHistoryItem {
  id: number;
  date: string;
  texte: string;
  user: string;
  filters?: string;
  langue?: string;
  status: string;
}

export interface HistoryPaginatedResponse {
  questions: QuestionHistoryItem[];
  total_items: number;
  page: number;
  per_page: number;
  total_pages: number;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="history-page">
  <!-- Stats Header Row -->
  <div class="stats-row grid-3">
    <div class="stat-card card">
      <div class="stat-icon icon-teal">📜</div>
      <div class="stat-info">
        <div class="stat-val">{{ totalItems() }}</div>
        <div class="stat-lbl">Recherches effectuées</div>
      </div>
    </div>

    <div class="stat-card card">
      <div class="stat-icon icon-gold">👨‍⚖️</div>
      <div class="stat-info">
        <div class="stat-val">{{ sentToExpertCount() }}</div>
        <div class="stat-lbl">Transmises à l'expert</div>
      </div>
    </div>

    <div class="stat-card card">
      <div class="stat-icon icon-navy">🕒</div>
      <div class="stat-info">
        <div class="stat-val stat-val-sm">{{ lastSearchDate() || '—' }}</div>
        <div class="stat-lbl">Dernière recherche</div>
      </div>
    </div>
  </div>

  <!-- Search & Filter Controls -->
  <div class="controls-card card animate-fadeInUp">
    <div class="controls-row">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input class="form-control input-with-icon" type="text"
               placeholder="Filtrer l'historique par mot-clé..."
               [(ngModel)]="searchFilter" (ngModelChange)="applyLocalFilter()" />
      </div>

      <div class="status-tabs">
        <button class="tab-btn" [class.active]="selectedTab === 'ALL'" (click)="setTab('ALL')">
          Tous ({{ questions().length }})
        </button>
        <button class="tab-btn" [class.active]="selectedTab === 'NORMAL'" (click)="setTab('NORMAL')">
          Standard
        </button>
        <button class="tab-btn" [class.active]="selectedTab === 'EXPERT'" (click)="setTab('EXPERT')">
          👨‍⚖️ Transmises ({{ sentToExpertCount() }})
        </button>
      </div>
    </div>
  </div>

  <!-- Feedback alert -->
  <div class="alert-success" *ngIf="successMsg()">
    <span>✅ {{ successMsg() }}</span>
  </div>
  <div class="alert-error" *ngIf="errorMsg()">
    <span>⚠️ {{ errorMsg() }}</span>
  </div>

  <!-- History Items List -->
  <div class="history-list card animate-fadeInUp">
    <div class="loading-state" *ngIf="loading()">
      <div class="spinner"></div>
      <span>Chargement de l'historique...</span>
    </div>

    <div class="empty-state" *ngIf="!loading() && filteredQuestions().length === 0">
      <div class="empty-icon">📭</div>
      <h3>Aucune recherche trouvée</h3>
      <p>Vous n'avez pas encore d'historique correspondant à ces critères.</p>
    </div>

    <div class="history-table-wrapper" *ngIf="!loading() && filteredQuestions().length > 0">
      <table class="history-table">
        <thead>
          <tr>
            <th>Date & Heure</th>
            <th>Requête recherchée</th>
            <th>Statut</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of filteredQuestions()" class="history-row">
            <td class="col-date">
              <span class="date-badge">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                {{ item.date }}
              </span>
            </td>

            <td class="col-query">
              <div class="query-text">{{ item.texte }}</div>
              <div class="query-meta" *ngIf="item.langue">
                <span class="lang-tag">{{ item.langue | uppercase }}</span>
              </div>
            </td>

            <td class="col-status">
              <span [class]="getStatusClass(item.status)">
                {{ getStatusLabel(item.status) }}
              </span>
            </td>

            <td class="col-actions text-right">
              <div class="action-buttons">
                <!-- Relaunch search -->
                <button class="action-btn btn-search" (click)="relaunchSearch(item)" title="Rechercher à nouveau">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  Rechercher
                </button>

                <!-- Send to Expert -->
                <button class="action-btn btn-expert"
                        *ngIf="!isExpert(item.status)"
                        (click)="sendToExpert(item)"
                        [disabled]="actionLoadingId === item.id"
                        title="Transmettre cette question à un expert juridique">
                  👨‍⚖️ Expert
                </button>

                <!-- Delete -->
                <button class="action-btn btn-delete"
                        (click)="deleteItem(item)"
                        [disabled]="actionLoadingId === item.id"
                        title="Supprimer de l'historique">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination Footer -->
    <div class="pagination-footer" *ngIf="totalPages() > 1">
      <span class="pagination-info">
        Page {{ currentPage() }} sur {{ totalPages() }} ({{ totalItems() }} éléments)
      </span>
      <div class="pagination-btns">
        <button class="btn btn-secondary btn-sm" (click)="changePage(currentPage() - 1)" [disabled]="currentPage() <= 1">
          ← Précédent
        </button>
        <button class="btn btn-secondary btn-sm" (click)="changePage(currentPage() + 1)" [disabled]="currentPage() >= totalPages()">
          Suivant →
        </button>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .history-page { display: flex; flex-direction: column; gap: 20px; }

    /* STATS ROW */
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    @media (max-width: 768px) { .grid-3 { grid-template-columns: 1fr; } }

    .stat-card { display: flex; align-items: center; gap: 16px; padding: 20px; }
    .stat-icon {
      width: 48px; height: 48px; border-radius: 12px; display: flex;
      align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;
    }
    .icon-teal { background: rgba(0,166,147,.1); color: var(--primary-dark); }
    .icon-gold { background: rgba(217,119,6,.1); color: #d97706; }
    .icon-navy { background: rgba(10,31,78,.08); color: var(--navy); }

    .stat-info { display: flex; flex-direction: column; }
    .stat-val { font-size: 24px; font-weight: 700; color: var(--navy); line-height: 1.2; }
    .stat-val-sm { font-size: 15px; font-weight: 600; }
    .stat-lbl { font-size: 12px; color: var(--text-muted); font-weight: 500; }

    /* CONTROLS */
    .controls-card { padding: 16px 20px; }
    .controls-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .search-box { position: relative; flex: 1; min-width: 260px; }
    .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-light); }
    .input-with-icon { padding-left: 40px; }

    .status-tabs { display: flex; gap: 6px; background: var(--bg); padding: 4px; border-radius: 10px; }
    .tab-btn {
      padding: 8px 16px; border: none; background: transparent; font-size: 13px;
      font-weight: 600; color: var(--text-muted); border-radius: 8px; cursor: pointer; transition: var(--transition);
    }
    .tab-btn:hover { color: var(--navy); }
    .tab-btn.active { background: var(--bg-white); color: var(--navy); box-shadow: var(--shadow-sm); }

    /* ALERTS */
    .alert-success {
      background: rgba(16,185,129,.1); border: 1px solid rgba(16,185,129,.2);
      color: #059669; padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 500;
    }
    .alert-error {
      background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.2);
      color: #dc2626; padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 500;
    }

    /* TABLE LIST */
    .history-list { padding: 0; overflow: hidden; }
    .loading-state, .empty-state { padding: 48px 24px; text-align: center; color: var(--text-muted); }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    .empty-state h3 { color: var(--navy); margin-bottom: 4px; }

    .history-table-wrapper { overflow-x: auto; }
    .history-table { width: 100%; border-collapse: collapse; text-align: left; }
    .history-table th {
      background: #f8fafc; padding: 14px 20px; font-size: 12px; font-weight: 700;
      color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid var(--border);
    }
    .history-table td { padding: 16px 20px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .history-row:hover { background: rgba(248,250,252,.7); }

    .date-badge {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; color: var(--text-muted); font-weight: 500; font-family: monospace;
    }
    .query-text { font-size: 14px; font-weight: 600; color: var(--navy); line-height: 1.4; }
    .query-meta { margin-top: 4px; }
    .lang-tag {
      font-size: 10px; font-weight: 700; background: var(--bg); color: var(--text-muted);
      padding: 2px 6px; border-radius: 4px; text-transform: uppercase;
    }

    .status-pill {
      display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px;
      font-size: 12px; font-weight: 600; white-space: nowrap;
    }
    .pill-normal { background: rgba(10,31,78,.08); color: var(--navy); }
    .pill-expert { background: rgba(217,119,6,.12); color: #b45309; }

    .action-buttons { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
    .action-btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
      font-size: 12px; font-weight: 600; border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg-white); cursor: pointer; transition: var(--transition);
    }
    .btn-search:hover { border-color: var(--primary); color: var(--primary-dark); background: rgba(0,166,147,.08); }
    .btn-expert:hover { border-color: #d97706; color: #b45309; background: rgba(217,119,6,.08); }
    .btn-delete:hover { border-color: #ef4444; color: #dc2626; background: rgba(239,68,68,.08); }

    /* PAGINATION */
    .pagination-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; background: #f8fafc; border-top: 1px solid var(--border);
    }
    .pagination-info { font-size: 13px; color: var(--text-muted); }
    .pagination-btns { display: flex; gap: 8px; }
    .text-right { text-align: right; }
  `]
})
export class HistoryComponent implements OnInit {
  questions = signal<QuestionHistoryItem[]>([]);
  filteredQuestions = signal<QuestionHistoryItem[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);
  totalItems = signal(0);
  perPage = 15;

  searchFilter = '';
  selectedTab: 'ALL' | 'NORMAL' | 'EXPERT' = 'ALL';

  actionLoadingId: number | null = null;
  successMsg = signal('');
  errorMsg = signal('');

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadHistory(1);
  }

  get headers(): HttpHeaders {
    const token = this.auth.token();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  loadHistory(page: number = 1) {
    this.loading.set(true);
    this.errorMsg.set('');

    const url = `http://127.0.0.1:5000/api/question/users/questions/pagination?page=${page}&per_page=${this.perPage}`;

    this.http.get<HistoryPaginatedResponse>(url, { headers: this.headers }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.questions.set(res.questions || []);
        this.currentPage.set(res.page || 1);
        this.totalPages.set(res.total_pages || 1);
        this.totalItems.set(res.total_items || (res.questions ? res.questions.length : 0));
        this.applyLocalFilter();
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set('Impossible de charger l\'historique des recherches.');
        console.error('Failed to load history:', err);
      }
    });
  }

  applyLocalFilter() {
    let items = [...this.questions()];

    // Tab filter
    if (this.selectedTab === 'EXPERT') {
      items = items.filter(i => this.isExpert(i.status));
    } else if (this.selectedTab === 'NORMAL') {
      items = items.filter(i => !this.isExpert(i.status));
    }

    // Text search filter
    if (this.searchFilter.trim()) {
      const q = this.searchFilter.toLowerCase().trim();
      items = items.filter(i =>
        i.texte.toLowerCase().includes(q) ||
        (i.date && i.date.toLowerCase().includes(q))
      );
    }

    this.filteredQuestions.set(items);
  }

  setTab(tab: 'ALL' | 'NORMAL' | 'EXPERT') {
    this.selectedTab = tab;
    this.applyLocalFilter();
  }

  isExpert(status: any): boolean {
    if (!status) return false;
    const s = status.toString().toLowerCase();
    return s.includes('expert') || s.includes('sent_to_expert');
  }

  getStatusLabel(status: any): string {
    if (this.isExpert(status)) {
      return "👨‍⚖️ Transmis à l'expert";
    }
    const s = (status || '').toString().toLowerCase();
    if (s.includes('jurisprudence')) {
      return '📚 Jurisprudence';
    }
    return '🔍 Recherche Standard';
  }

  getStatusClass(status: any): string {
    if (this.isExpert(status)) return 'status-pill pill-expert';
    const s = (status || '').toString().toLowerCase();
    if (s.includes('jurisprudence')) return 'status-pill pill-jurisprudence';
    return 'status-pill pill-normal';
  }

  sentToExpertCount(): number {
    return this.questions().filter(q => this.isExpert(q.status)).length;
  }

  lastSearchDate(): string {
    const list = this.questions();
    return list.length > 0 ? list[0].date : '';
  }

  relaunchSearch(item: QuestionHistoryItem) {
    // On transmet l'id ET le texte : le backend reutilisera la question
    // existante au lieu d'en creer une nouvelle a chaque relance.
    this.router.navigate(['/dashboard/search'], {
      queryParams: { q: item.texte, question_id: item.id }
    });
  }

  sendToExpert(item: QuestionHistoryItem) {
    this.actionLoadingId = item.id;
    this.successMsg.set('');
    this.errorMsg.set('');

    const url = `http://127.0.0.1:5000/api/question/questions/${item.id}/send-to-expert`;

    this.http.post(url, {}, { headers: this.headers }).subscribe({
      next: () => {
        this.actionLoadingId = null;
        item.status = 'Sent to expert';
        this.successMsg.set(`La question "${item.texte}" a été transmise avec succès à l'expert !`);
        this.applyLocalFilter();
        setTimeout(() => this.successMsg.set(''), 4000);
      },
      error: (err) => {
        this.actionLoadingId = null;
        this.errorMsg.set('Erreur lors du transfert à l\'expert.');
      }
    });
  }

  deleteItem(item: QuestionHistoryItem) {
    if (!confirm(`Voulez-vous vraiment supprimer la recherche "${item.texte}" de votre historique ?`)) return;

    this.actionLoadingId = item.id;
    this.successMsg.set('');
    this.errorMsg.set('');

    const url = `http://127.0.0.1:5000/api/question/question/${item.id}`;

    this.http.delete(url, { headers: this.headers }).subscribe({
      next: () => {
        this.actionLoadingId = null;
        this.questions.update(list => list.filter(q => q.id !== item.id));
        this.totalItems.update(v => Math.max(0, v - 1));
        this.successMsg.set('Recherche supprimée de votre historique.');
        this.applyLocalFilter();
        setTimeout(() => this.successMsg.set(''), 4000);
      },
      error: (err) => {
        this.actionLoadingId = null;
        this.errorMsg.set('Erreur lors de la suppression.');
      }
    });
  }

  changePage(newPage: number) {
    if (newPage >= 1 && newPage <= this.totalPages()) {
      this.loadHistory(newPage);
    }
  }
}