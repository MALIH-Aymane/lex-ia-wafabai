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
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss'],
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