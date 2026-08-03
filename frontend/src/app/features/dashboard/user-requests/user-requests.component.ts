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
  template: `
<div class="user-requests-page">

  <!-- HERO HEADER -->
  <div class="hero-card card animate-fadeInUp">
    <div class="hero-content">
      <div class="hero-icon-box">📩</div>
      <div>
        <h2>Demandes & Sollicitations Juridiques</h2>
        <p>Consultez les questions transmises par les utilisateurs, générez la synthèse IA et publiez les réponses officielles.</p>
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
        placeholder="Filtrer par mots-clés ou nom d'utilisateur..."
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

  <!-- SUCCESS BANNER -->
  <div class="success-banner animate-fadeInUp" *ngIf="successMsg()">
    <span>✓ {{ successMsg() }}</span>
  </div>

  <!-- LOADING STATE -->
  <div class="loading-state" *ngIf="loading()">
    <span class="spinner" style="width:40px; height:40px"></span>
    <h4>Chargement des demandes utilisateurs...</h4>
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
        <span class="user-chip">👤 {{ q.user || 'Utilisateur' }}</span>
        <span class="date-chip">📅 {{ q.date || 'Récemment' }}</span>
      </div>

      <div class="req-actions">
        <button class="btn btn-primary btn-sm btn-block" (click)="handleRequestAction(q)">
          <span *ngIf="q.status === 'Sent to expert' || q.status === 'SENT_TO_EXPERT'">✏️ Traiter & Répondre</span>
          <span *ngIf="q.status !== 'Sent to expert' && q.status !== 'SENT_TO_EXPERT'">👁️ Consulter la réponse</span>
        </button>
      </div>
    </div>
  </div>

  <!-- EMPTY STATE -->
  <div class="empty-state card" *ngIf="!loading() && filteredQuestions().length === 0">
    <div class="empty-icon">🎉</div>
    <h3>Aucune demande dans cette catégorie</h3>
    <p>Toutes les sollicitations juridiques de vos utilisateurs ont été traitées ou aucun résultat ne correspond à votre filtre.</p>
  </div>

  <!-- ANSWER / RESPONSE MODAL -->
  <div class="modal-overlay" *ngIf="activeQuestion()" (click)="closeAnswerModal()">
    <div class="modal-box answer-modal-box animate-fadeInUp" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div style="display:flex; align-items:center; gap:12px">
          <div class="modal-icon-badge">⚖️</div>
          <div>
            <h3 style="margin:0; font-size:18px; color:var(--navy)">Traitement de la Demande #{{ activeQuestion()?.id }}</h3>
            <span class="text-muted" style="font-size:12px">Rédigez la réponse réglementaire officielle</span>
          </div>
        </div>
        <button class="modal-close" (click)="closeAnswerModal()">✕</button>
      </div>

      <div class="modal-body-content" style="flex:1; overflow-y:auto; padding:16px 0">
        <!-- Question banner -->
        <div class="question-callout">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
            <span class="callout-label">QUESTION DE L'UTILISATEUR ({{ activeQuestion()?.user }})</span>
            <span class="callout-date">📅 {{ activeQuestion()?.date }}</span>
          </div>
          <h4 class="callout-text">« {{ activeQuestion()?.texte }} »</h4>
        </div>

        <!-- AI Draft Generator Button -->
        <div class="ai-draft-box" style="margin-bottom:18px">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px">
            <div>
              <strong style="color:var(--navy); font-size:13.5px">💡 Assistant IA de Rédaction :</strong>
              <p style="margin:2px 0 0; font-size:12px; color:var(--text-muted)">Générez automatiquement une ébauche de rapport synthétique à l'aide des modèles LLM.</p>
            </div>
            <button class="btn btn-outline btn-sm" (click)="generateAiDraft()" [disabled]="aiGenerating()">
              <span class="spinner-sm" *ngIf="aiGenerating()"></span>
              <span *ngIf="!aiGenerating()">🤖 Générer une ébauche par l'IA</span>
            </button>
          </div>
        </div>

        <!-- Answer Content Textarea -->
        <div class="form-group" style="margin-bottom:16px">
          <label class="form-label" style="font-weight:700; color:var(--navy); margin-bottom:6px; display:block">
            Réponse Juridique Officielle (Format rapport) :
          </label>
          <textarea
            class="form-control answer-textarea"
            rows="10"
            [(ngModel)]="answerContent"
            placeholder="Rédigez la réponse réglementaire explicative..."
          ></textarea>
        </div>

        <!-- Status selector -->
        <div class="form-group" style="display:flex; align-items:center; gap:16px">
          <label class="form-label" style="font-weight:700; color:var(--navy); margin:0">Statut de la publication :</label>
          <select class="filter-select" [(ngModel)]="answerStatus" style="height:36px; font-size:13px; min-width:180px">
            <option value="PUBLISHED">✓ Publier en Jurisprudence</option>
            <option value="DRAFT">📝 Enregistrer en Brouillon</option>
          </select>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="modal-actions" style="margin-top:16px; border-top:1px solid var(--border-light); padding-top:16px; display:flex; justify-content:flex-end; gap:10px">
        <button class="btn btn-ghost" (click)="closeAnswerModal()">Annuler</button>
        <button class="btn btn-primary" (click)="submitAnswer()" [disabled]="submitting() || !answerContent.trim()">
          <span class="spinner-sm" *ngIf="submitting()"></span>
          <span *ngIf="!submitting()">🚀 Valider & Publier la Réponse</span>
        </button>
      </div>
    </div>
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

    .success-banner {
      background: #ecfdf5; border: 1.5px solid #a7f3d0; color: #065f46;
      padding: 12px 18px; border-radius: 10px; font-size: 13.5px; font-weight: 600;
    }

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

    .badge-pending { background: rgba(245,158,11,.15); color: #92400e; }
    .badge-processed { background: rgba(16,185,129,.15); color: #065f46; }
    .badge-normal { background: rgba(107,114,128,.1); color: #374151; }

    .empty-state { text-align: center; padding: 70px 20px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .empty-icon { font-size: 50px; }
    .empty-state h3 { color: var(--navy); margin: 0; }
    .empty-state p { color: var(--text-muted); font-size: 13.5px; margin: 0; max-width: 420px; }

    /* MODAL */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(10,31,78,.45);
      backdrop-filter: blur(4px); z-index: 999; display: flex;
      align-items: center; justify-content: center; padding: 20px;
    }
    .answer-modal-box {
      width: 100%; max-width: 800px; max-height: 90vh; display: flex;
      flex-direction: column; background: #ffffff; border-radius: 20px; padding: 26px; box-shadow: 0 20px 50px rgba(10,31,78,0.25);
    }
    .modal-icon-badge {
      width: 40px; height: 40px; border-radius: 10px; background: rgba(10,31,78,0.08);
      display: flex; align-items: center; justify-content: center; font-size: 20px;
    }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid var(--border-light); }
    .modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted); }

    .question-callout {
      background: linear-gradient(135deg, #0a1f4e 0%, #142a6e 100%); color: #ffffff;
      padding: 16px 20px; border-radius: 12px; margin-bottom: 16px;
    }
    .callout-label { font-size: 9px; font-weight: 800; letter-spacing: 2px; color: #c8842a; text-transform: uppercase; }
    .callout-date { font-size: 11.5px; opacity: 0.8; }
    .callout-text { font-size: 15px; font-weight: 700; margin: 6px 0 0 0; color: #ffffff; line-height: 1.4; }

    .ai-draft-box {
      background: rgba(255,122,0,0.05); border: 1px solid rgba(255,122,0,0.2);
      padding: 12px 16px; border-radius: 10px;
    }
    .answer-textarea {
      width: 100%; padding: 12px; border-radius: 10px; border: 1.5px solid var(--border-light);
      font-size: 13.5px; line-height: 1.6; outline: none; transition: border-color 0.2s; resize: vertical;
    }
    .answer-textarea:focus { border-color: var(--primary); }
  `]
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
