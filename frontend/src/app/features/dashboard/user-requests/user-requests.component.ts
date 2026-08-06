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
  status: string; // 'Sent to expert', 'Jurisprudence', 'Normal'
}

@Component({
  selector: 'app-user-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-requests.component.html',
  styleUrls: ['./user-requests.component.scss'],
})
export class UserRequestsComponent implements OnInit {
  questions = signal<UserQuestion[]>([]);
  loading = signal(false);
  searchQuery = '';
  activeTab = signal<'PENDING' | 'PROCESSED' | 'ALL'>('PENDING');

  activeQuestion = signal<UserQuestion | null>(null);
  answerContent = '';
  answerStatus = 'PUBLISHED';
  aiGenerating = signal(false);
  submitting = signal(false);
  successMsg = signal('');

  constructor(private http: HttpClient, private auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.loadQuestions();
  }

  loadQuestions() {
    this.loading.set(true);
    const token = this.auth.token() || localStorage.getItem('lex_token') || '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.get<any>('http://127.0.0.1:5000/api/question/questions', { headers }).subscribe({
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
        (item.texte && item.texte.toLowerCase().includes(q)) ||
        (item.user && item.user.toLowerCase().includes(q))
      );
    }

    return list;
  }

  formatStatusLabel(status: string): string {
    if (status === 'Sent to expert' || status === 'SENT_TO_EXPERT') return 'En attente d\'expert';
    if (status === 'Jurisprudence' || status === 'JURISPRUDENCE') return 'Traitée (Jurisprudence)';
    return status || 'Normale';
  }

  getStatusBadgeClass(status: string): string {
    if (status === 'Sent to expert' || status === 'SENT_TO_EXPERT') return 'badge badge-pending';
    if (status === 'Jurisprudence' || status === 'JURISPRUDENCE') return 'badge badge-processed';
    return 'badge badge-normal';
  }

  handleRequestAction(q: UserQuestion) {
    if (q.status === 'Sent to expert' || q.status === 'SENT_TO_EXPERT') {
      this.router.navigate(['/dashboard/search'], { queryParams: { q: q.texte, question_id: q.id } });
    } else {
      this.openAnswerModal(q);
    }
  }

  openAnswerModal(q: UserQuestion) {
    this.activeQuestion.set(q);
    this.answerContent = '';
    this.answerStatus = 'PUBLISHED';
    document.body.style.overflow = 'hidden';
  }

  closeAnswerModal() {
    this.activeQuestion.set(null);
    document.body.style.overflow = '';
  }

  generateAiDraft() {
    const q = this.activeQuestion();
    if (!q) return;

    this.aiGenerating.set(true);
    const token = this.auth.token() || '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    const payload = {
      query: q.texte,
      context: []
    };

    this.http.post<any>('http://127.0.0.1:5000/api/recherche/recherche_interpretation', payload, { headers }).subscribe({
      next: (res) => {
        this.answerContent = res.answer || res.report || '';
        this.aiGenerating.set(false);
      },
      error: (err) => {
        console.error('Erreur génération ébauche IA:', err);
        this.aiGenerating.set(false);
      }
    });
  }

  submitAnswer() {
    const q = this.activeQuestion();
    if (!q || !this.answerContent.trim()) return;

    this.submitting.set(true);
    const token = this.auth.token() || '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    const payload = {
      question_id: q.id,
      content: this.answerContent,
      html_content: this.answerContent,
      status: this.answerStatus
    };

    this.http.post<any>('http://127.0.0.1:5000/api/jurisprudence/responses', payload, { headers }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeAnswerModal();
        this.successMsg.set(`Réponse enregistrée pour la question #${q.id} et publiée en jurisprudence !`);
        setTimeout(() => this.successMsg.set(''), 5000);
        this.loadQuestions();
      },
      error: (err) => {
        console.error('Erreur validation réponse:', err);
        this.submitting.set(false);
      }
    });
  }
}
