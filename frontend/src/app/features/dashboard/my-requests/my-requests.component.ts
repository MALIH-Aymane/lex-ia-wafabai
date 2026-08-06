import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

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
  templateUrl: './my-requests.component.html',
  styleUrls: ['./my-requests.component.scss'],
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
    this.http.get<any>('http://127.0.0.1:5000/api/question/users/questions/by-status?status=SENT_TO_EXPERT,JURISPRUDENCE', { headers }).subscribe({
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

    this.http.delete(`http://127.0.0.1:5000/api/question/question/${id}`, { headers }).subscribe({
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
