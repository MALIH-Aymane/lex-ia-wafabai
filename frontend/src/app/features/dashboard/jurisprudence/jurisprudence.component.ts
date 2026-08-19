import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

export interface JurisprudenceHit {
  result_id: string;
  score: number;
  reponse: {
    id?: number;
    question_id?: number;
    question?: string;
    content?: string;
    html_content?: string;
    status?: string;
    sources?: any[];
    created_at?: string;
    updated_at?: string;
    provider_id?: number;
  };
}

@Component({
  selector: 'app-jurisprudence',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './jurisprudence.component.html',
  styleUrls: ['./jurisprudence.component.scss'],
})
export class JurisprudenceComponent implements OnInit {
  query = '';
  results = signal<JurisprudenceHit[]>([]);
  loading = signal(false);
  hasSearched = signal(false);
  statusFilter = signal<'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'>('ALL');
  activeDetailItem = signal<JurisprudenceHit | null>(null);
  copySuccess = signal(false);

  // New response modal (Admin/Legal Manager)
  showNewModal = signal(false);
  newForm = { question_id: null as number | null, content: '', status: 'PUBLISHED' };

  // Simple user request state
  requestSubmitting = signal(false);
  requestSuccess = signal(false);

  suggestedQueries = [
    'Prescription des créances commerciales',
    'Ratio de solvabilité BAM',
    'Garantie autonome bancaire',
    'Responsabilité du banquier dispensateur'
  ];

  constructor(private http: HttpClient, private auth: AuthService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['q']) {
        this.query = params['q'];
      }
      this.search();
    });
  }

  canManage(): boolean {
    return this.auth.hasRole(['Administrateur', 'Responsable juridique']);
  }

  useQuery(q: string) {
    this.query = q;
    this.search();
  }

  search() {
    this.loading.set(true);
    this.hasSearched.set(true);
    this.requestSuccess.set(false);

    const token = this.auth.token() || localStorage.getItem('lex_token') || '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    const searchQuery = this.query.trim() || 'jurisprudence réglementation bancaire maroc';

    const payload = {
      query: searchQuery,
      limit: 50,
      langue: 'fr',
      filters: []
    };

    this.http.post<any>(`${environment.apiUrl}/api/recherche/jurispridance`, payload, { headers }).subscribe({
      next: (res) => {
        const hits = res.results || [];
        this.results.set(hits);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erreur recherche jurisprudence:', err);
        this.results.set([]);
        this.loading.set(false);
      }
    });
  }

  filteredResults(): JurisprudenceHit[] {
    const raw = this.results();

    // SIMPLE USERS ONLY SEE PUBLISHED JURISPRUDENCE
    if (!this.canManage()) {
      return raw.filter(r => (r.reponse?.status || 'DRAFT').toUpperCase() === 'PUBLISHED');
    }

    const filter = this.statusFilter();
    if (filter === 'ALL') return raw;
    return raw.filter(r => (r.reponse?.status || 'DRAFT').toUpperCase() === filter);
  }

  openDetailModal(item: JurisprudenceHit) {
    this.activeDetailItem.set(item);
    this.copySuccess.set(false);
    document.body.style.overflow = 'hidden';
  }

  closeDetailModal() {
    this.activeDetailItem.set(null);
    document.body.style.overflow = '';
  }

  getResponseId(item: JurisprudenceHit): number | string | null {
    if (item.reponse?.id) return item.reponse.id;
    if (item.reponse?.question_id) return item.reponse.question_id;
    return null;
  }

  // --- MANAGEMENT ACTIONS (Admin & Responsable Juridique) ---
  changeStatus(item: JurisprudenceHit, newStatus: string) {
    const respId = this.getResponseId(item);
    if (!respId) {
      console.warn('Impossible de trouver l\'identifiant de la jurisprudence');
      return;
    }

    const token = this.auth.token() || localStorage.getItem('lex_token') || '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.put<any>(`${environment.apiUrl}/api/jurisprudence/responses/${respId}/status`, { status: newStatus }, { headers }).subscribe({
      next: () => {
        item.reponse.status = newStatus;
        this.search();
      },
      error: (err) => console.error('Erreur mise à jour statut:', err)
    });
  }

  deleteJurisprudence(item: JurisprudenceHit) {
    const respId = this.getResponseId(item);
    if (!respId) {
      console.warn('Impossible de trouver l\'identifiant de la jurisprudence à supprimer');
      return;
    }
    if (!confirm('Voulez-vous vraiment supprimer cette jurisprudence ?')) return;

    const token = this.auth.token() || localStorage.getItem('lex_token') || '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.delete<any>(`${environment.apiUrl}/api/jurisprudence/responses/${respId}`, { headers }).subscribe({
      next: () => {
        this.closeDetailModal();
        this.search();
      },
      error: (err) => console.error('Erreur suppression jurisprudence:', err)
    });
  }

  submitNewResponse() {
    if (!this.newForm.question_id) return;
    const token = this.auth.token() || '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    const payload = {
      question_id: this.newForm.question_id,
      content: this.newForm.content,
      status: this.newForm.status,
      sources: []
    };

    this.http.post(`${environment.apiUrl}/api/jurisprudence/responses`, payload, { headers }).subscribe({
      next: () => {
        this.showNewModal.set(false);
        this.newForm = { question_id: null, content: '', status: 'PUBLISHED' };
        this.search();
      },
      error: (e) => console.error('Erreur création jurisprudence:', e)
    });
  }

  // --- SIMPLE USER QUESTION REQUEST SUBMISSION ---
  submitQuestionToLegal() {
    if (!this.query.trim()) return;
    this.requestSubmitting.set(true);

    const token = this.auth.token() || '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.post<any>(`${environment.apiUrl}/api/jurisprudence/submit_request`, { query: this.query }, { headers }).subscribe({
      next: () => {
        this.requestSubmitting.set(false);
        this.requestSuccess.set(true);
        setTimeout(() => this.requestSuccess.set(false), 6000);
      },
      error: (err) => {
        console.error('Erreur soumission demande:', err);
        this.requestSubmitting.set(false);
      }
    });
  }

  getScorePercentage(score: number): string {
    const s = Math.min(Math.max(score || 0, 0), 1);
    return Math.round(s * 100) + '%';
  }

  getScoreClass(score: number): string {
    if (score >= 0.75) return 'score-badge score-high';
    if (score >= 0.5)  return 'score-badge score-med';
    return 'score-badge score-low';
  }

  statusBadge(status: string): string {
    return `badge badge-${(status || 'DRAFT').toUpperCase()}`;
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'Date inconnue';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  getSourcesCount(sources?: any): number {
    if (!sources) return 0;
    if (Array.isArray(sources)) return sources.length;
    if (typeof sources === 'string') {
      try {
        const parsed = JSON.parse(sources);
        return Array.isArray(parsed) ? parsed.length : 1;
      } catch {
        return 1;
      }
    }
    return 1;
  }

  truncateText(text: string, maxLen: number): string {
    if (!text) return '';
    const clean = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen) + '...';
  }

  getFormattedReportContent(item: JurisprudenceHit): string {
    const rawHtml = item.reponse?.html_content;
    if (rawHtml && rawHtml.trim()) {
      return rawHtml;
    }

    const text = item.reponse?.content || '';
    if (!text) return '<p>Aucun contenu de rapport disponible.</p>';

    return this.formatReportHtml(text);
  }

  formatReportHtml(text: string): string {
    if (!text) return '';

    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F900}-\u{1F9FF}]/gu, '');

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li class="report-list-item">$1</li>');

    const sections: { [key: string]: { title: string; class: string; numLabel: string } } = {
      'TITRE':                        { title: '',                                      numLabel: '',    class: 'report-section-title-block' },
      'SYNTHÈSE EXÉCUTIVE':           { title: 'Synthèse Exécutive',                    numLabel: '01.', class: 'report-section-executive' },
      'ANALYSE JURIDIQUE DÉTAILLÉE':  { title: 'Analyse Juridique Détaillée',           numLabel: '02.', class: 'report-section-detail' },
      'IMPACTS POUR LA BANQUE':       { title: 'Impacts Opérationnels',                 numLabel: '03.', class: 'report-section-impacts' },
      'LIMITES ET INCERTITUDES':      { title: 'Limites & Incertitudes Réglementaires', numLabel: '04.', class: 'report-section-limits' },
      'CONCLUSION OPÉRATIONNELLE':    { title: 'Conclusion & Recommandations',          numLabel: '05.', class: 'report-section-conclusion' }
    };

    const regex = /\[(TITRE|SYNTHÈSE EXÉCUTIVE|ANALYSE JURIDIQUE DÉTAILLÉE|IMPACTS POUR LA BANQUE|LIMITES ET INCERTITUDES|CONCLUSION OPÉRATIONNELLE)\]([\s\S]*?)(?=\[(?:TITRE|SYNTHÈSE EXÉCUTIVE|ANALYSE JURIDIQUE DÉTAILLÉE|IMPACTS POUR LA BANQUE|LIMITES ET INCERTITUDES|CONCLUSION OPÉRATIONNELLE)\]|$)/g;

    let match;
    let formattedHtml = '';
    let hasMatches = false;
    regex.lastIndex = 0;

    while ((match = regex.exec(html)) !== null) {
      hasMatches = true;
      const key = match[1];
      let content = match[2].trim();
      const meta = sections[key];
      if (!meta) continue;

      content = content.replace(/^### (.*)$/gm, '<h5 class="report-subhdr-ref">$1</h5>');
      content = content.replace(/^## (.*)$/gm, '<h5 class="report-subhdr-ref">$1</h5>');
      content = content.replace(/\n\n/g, '</p><p>');
      content = content.replace(/\n/g, '<br>');
      if (content && !content.startsWith('<p>') && !content.startsWith('<h')) {
        content = '<p>' + content + '</p>';
      }

      content = content.replace(/(<li class="report-list-item">.*?<\/li>)+/g, listBlock =>
        '<ul class="report-ul">' + listBlock + '</ul>'
      );

      if (key === 'TITRE') {
        const titleText = content.replace(/<\/?p>/g, '').replace(/<br>/g, ' ').trim();
        formattedHtml += `
          <div class="report-section-title-block">
            <div class="report-title-label">RAPPORT DE JURISPRUDENCE RÉGLEMENTAIRE</div>
            <h2 class="report-main-title">${titleText}</h2>
          </div>`;
      } else {
        formattedHtml += `
          <div class="report-card-section ${meta.class}">
            <div class="report-card-header">
              <span class="report-section-num">${meta.numLabel}</span>
              <h4 class="report-card-title">${meta.title}</h4>
            </div>
            <div class="report-card-body">${content}</div>
          </div>`;
      }
    }

    if (!hasMatches) {
      let fallback = html;
      fallback = fallback.replace(/^### (.*$)/gim, '<h5 class="report-subhdr-ref">$1</h5>');
      fallback = fallback.replace(/^## (.*$)/gim, '<h4 class="report-section-hdr">$1</h4>');
      fallback = fallback.replace(/^# (.*$)/gim, '<h3 class="report-main-title">$1</h3>');
      fallback = fallback.replace(/\n\n/g, '</p><p>');
      fallback = fallback.replace(/\n/g, '<br>');
      return '<p>' + fallback + '</p>';
    }

    return formattedHtml;
  }

  copyReportToClipboard() {
    const item = this.activeDetailItem();
    if (!item) return;
    const text = item.reponse.content || item.reponse.question || '';
    navigator.clipboard.writeText(text).then(() => {
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 3000);
    });
  }

  printReport() {
    window.print();
  }

  downloadReportPdf() {
    const item = this.activeDetailItem();
    if (!item) return;
    const reportHtml = this.getFormattedReportContent(item);
    const date = this.formatDate(item.reponse.created_at);
    const query = item.reponse.question || 'Question juridique';

    const logoSvg = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#0a1f4e"/>
      <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle"
            font-family="Georgia,serif" font-weight="800" font-size="22" fill="#c8842a">L</text>
    </svg>`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Jurisprudence Juridique LEX-IA</title>
  <style>
    @page { size: A4; margin: 18mm 20mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 11pt; color: #1a1a2e; background: #fff; }
    .page-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; margin-bottom: 4px; }
    .brand-block { display: flex; align-items: center; gap: 12px; }
    .brand-logo-svg { width: 44px; height: 44px; flex-shrink: 0; }
    .brand-text-col { display: flex; flex-direction: column; gap: 2px; }
    .brand-name { font-size: 20pt; font-weight: 800; color: #0a1f4e; letter-spacing: 1px; line-height: 1; }
    .brand-sub  { font-size: 7pt; font-weight: 700; color: #c8842a; letter-spacing: 2px; text-transform: uppercase; }
    .header-date { font-size: 9pt; color: #6c757d; text-align: right; }
    .header-divider { height: 3px; background: linear-gradient(90deg, #0a1f4e 55%, #c8842a 100%); margin: 8px 0 16px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .question-box { background: #f0f4f9; border-left: 4px solid #0a1f4e; padding: 10px 14px; margin-bottom: 22px; font-size: 10.5pt; color: #2c3e50; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .question-box strong { color: #0a1f4e; display: block; margin-bottom: 3px; font-size: 8pt; letter-spacing: 1px; text-transform: uppercase; }
    .report-section-title-block { background: #0a1f4e; color: #fff; padding: 16px 20px; border-radius: 6px; margin-bottom: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-title-label { font-size: 7.5pt; font-weight: 700; letter-spacing: 2px; color: #c8842a; text-transform: uppercase; margin-bottom: 6px; }
    .report-main-title { font-size: 15pt; font-weight: 700; color: #fff; line-height: 1.35; }
    .report-card-section { margin-bottom: 16px; border: 1px solid #dee2e6; border-left: 5px solid #0a1f4e; border-radius: 4px; padding: 13px 16px; page-break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-card-header { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e9ecef; padding-bottom: 8px; margin-bottom: 10px; }
    .report-section-num { font-size: 8pt; font-weight: 800; color: #c8842a; letter-spacing: 1px; min-width: 26px; }
    .report-card-title { font-size: 10.5pt; font-weight: 700; color: #0a1f4e; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }
    .report-card-body { font-size: 10.5pt; line-height: 1.72; color: #2c2c2c; }
    .report-card-body p { margin-bottom: 8px; }
    .report-card-body ul { margin: 6px 0 10px 18px; }
    .report-card-body li { margin-bottom: 4px; }
    .report-card-body strong { color: #0a1f4e; font-weight: 700; }
    .report-card-body em { font-style: italic; color: #495057; }
    h5.report-subhdr-ref { font-size: 10pt; font-weight: 700; color: #6c757d; margin: 10px 0 4px; font-style: italic; padding-left: 10px; border-left: 3px solid #dee2e6; }
    .report-section-executive  { border-left-color: #c8842a; }
    .report-section-detail     { border-left-color: #0a1f4e; }
    .report-section-impacts    { border-left-color: #c0392b; }
    .report-section-limits     { border-left-color: #e67e22; }
    .report-section-conclusion { border-left-color: #16a085; }
    .page-footer { margin-top: 28px; padding-top: 8px; border-top: 1px solid #dee2e6; display: flex; justify-content: space-between; font-size: 8pt; color: #6c757d; }
    .page-footer .confidential { color: #c8842a; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="page-header">
    <div class="brand-block">
      <div class="brand-logo-svg">${logoSvg}</div>
      <div class="brand-text-col">
        <span class="brand-name">LEX-IA</span>
        <span class="brand-sub">Conformit&eacute; &amp; Intelligence Artificielle Juridique</span>
      </div>
    </div>
    <div class="header-date">${date}</div>
  </div>
  <div class="header-divider"></div>
  <div class="question-box">
    <strong>Jurisprudence enregistr&eacute;e</strong>
    ${query}
  </div>
  ${reportHtml}
  <div class="page-footer">
    <span>Base de Jurisprudence LEX-IA &mdash; Bank Al-Maghrib Compliance Suite</span>
    <span class="confidential">Document Officiel Valid&eacute;</span>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.focus();
      setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 700);
    }
  }
}
