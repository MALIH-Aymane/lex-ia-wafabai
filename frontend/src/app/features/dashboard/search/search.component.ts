import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PdfViewerComponent } from './pdf-viewer.component';
import { environment } from '../../../../environments/environment';

interface SearchResult {
  score: number;
  reponse: Record<string, any>;
  result_id: string;
}

interface VectorCollection {
  name: string;
  embedding_model: string;
}

interface LLMModelOption {
  id: number;
  name: string;
  provider: string;
  is_active: boolean;
}

interface ResultGroup {
  groupKey: string;
  icon: string;
  count: number;
  maxScore: number;
  results: SearchResult[];
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, PdfViewerComponent],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent implements OnInit, OnDestroy {
  query = '';
  results = signal<SearchResult[]>([]);
  loading = signal(false);
  error = signal('');
  hasSearched = signal(false);

  // Grouping Mode signal (DEFAULT IS COLLECTION!)
  selectedGroupingMode = signal<'collection' | 'document' | 'grouping' | 'none'>('collection');

  // Selected references for AI Report generation
  selectedReferences = new Set<string>();
  selectedRefItemsMap = new Map<string, SearchResult>();

  // Enlarged Detail Modal
  activeDetailResult = signal<SearchResult | null>(null);

  // AI Report Modal
  showReportModal = signal(false);
  reportLoading = signal(false);
  generatedReport = signal('');
  copySuccess = signal(false);

  // Editable report & jurisprudence saving
  reportEditMode = signal(false);
  editedReportHtml = signal('');
  savedToJurisprudence = signal(false);
  saveLoading = signal(false);
  saveError = signal('');
  questionId = signal<number | null>(null);
  private initialQuestionId: number | null = null;
  private loadedQuestionText = '';

  // Filters
  showFilters = signal(false);
  selectedCollection = '';
  selectedGrouping = '';
  selectedLlmModel = '';
  limit = 30;
  collections = signal<VectorCollection[]>([]);
  availableGroupings = signal<string[]>([]);
  llmModels = signal<LLMModelOption[]>([]);

  // PDF Drawer
  pdfDrawerOpen = signal(false);
  activePdfUrl   = signal('');
  activePdfHighlight = signal('');
  activePdfTitle = signal('');
  activePdfPage  = signal<number | string>('');

  suggestedQueries = [
    'Fonds propres réglementaires',
    'Ratio de liquidité',
    'Obligations de reporting BAM',
    'Capital minimum bancaire',
  ];

  // Computed signal for grouped results (CACHED, avoids template re-creation flashes)
  groupedResults = computed<ResultGroup[]>(() => {
    const rawResults = this.results();
    const mode = this.selectedGroupingMode();
    if (!rawResults || rawResults.length === 0) return [];

    if (mode === 'none') {
      return [{
        groupKey: 'Tous les résultats',
        icon: '🔍',
        count: rawResults.length,
        maxScore: Math.max(...rawResults.map(r => r.score || 0)),
        results: rawResults
      }];
    }

    const groupsMap = new Map<string, SearchResult[]>();

    for (const r of rawResults) {
      let key = '';
      if (mode === 'collection') {
        key = (r.reponse['collection'] || this.selectedCollection || 'Collection').trim();
      } else if (mode === 'document') {
        key = (r.reponse['reference'] || r.reponse['levelvalue5'] || r.reponse['document'] || 'Document juridique').trim();
      } else if (mode === 'grouping') {
        key = (r.reponse['grouping'] || 'Sans groupe').trim();
      }

      if (!key) key = 'Autre';

      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(r);
    }

    const resultGroups: ResultGroup[] = [];
    const icon = mode === 'collection' ? '📁' : (mode === 'document' ? '📄' : '🏷️');

    groupsMap.forEach((records, key) => {
      const maxScore = Math.max(...records.map(r => r.score || 0));
      resultGroups.push({
        groupKey: key,
        icon: icon,
        count: records.length,
        maxScore: maxScore,
        results: records.sort((a, b) => (b.score || 0) - (a.score || 0))
      });
    });

    return resultGroups.sort((a, b) => b.maxScore - a.maxScore);
  });

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {}

  // --- Smart Grouping Truncation: 10 chars + .... + (Acronym of initial letters) ---
  formatGrouping(val: any): string {
    if (!val) return '';
    const str = String(val).trim();
    if (str.length <= 12) return str;

    const first10 = str.slice(0, 10);
    const words = str.split(/[\s_\-\/\.]+/).filter(w => w.length > 0);
    const initials = words.map(w => w.charAt(0).toUpperCase()).join('');

    return `${first10}.... (${initials})`;
  }

  toggleFilters() {
    this.showFilters.update(v => !v);
  }

  activeFilterCount(): number {
    let count = 0;
    if (this.selectedCollection) count++;
    if (this.selectedGrouping) count++;
    if (this.selectedGroupingMode() !== 'collection') count++;
    return count;
  }

  ngOnInit() {
    this.loadCollections();
    this.loadLlmModels();
    this.route.queryParams.subscribe(params => {
      if (params['question_id']) {
        this.initialQuestionId = Number(params['question_id']);
        this.questionId.set(this.initialQuestionId);
        this.loadedQuestionText = (params['q'] ?? '').trim();
      }
      if (params['q']) {
        this.query = params['q'];
        this.search();
      }
    });
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  trackByGroup(index: number, item: ResultGroup): string {
    return item.groupKey;
  }

  trackByResult(index: number, item: SearchResult): string {
    return item.result_id;
  }

  loadCollections() {
    this.http.get<any>(`${environment.apiUrl}/api/documents/vector-collections`).subscribe({
      next: (res) => {
        const cols = res.collections || [];
        this.collections.set(cols);
      },
      error: () => {}
    });
  }

  loadLlmModels() {
    this.http.get<LLMModelOption[]>(`${environment.apiUrl}/api/llm_models/llm-models/active`).subscribe({
      next: (ms) => {
        this.llmModels.set(ms);
        if (!this.selectedLlmModel && ms.length > 0) {
          const defaultMod = ms.find((m: any) => m.is_default);
          if (defaultMod) {
            this.selectedLlmModel = defaultMod.name;
          }
        }
      },
      error: () => {}
    });
  }

  onCollectionChange() {
    this.selectedGrouping = '';
    this.availableGroupings.set([]);
    if (!this.selectedCollection) return;

    this.http.get<any>(
      `${environment.apiUrl}/api/documents/db/collections/${this.selectedCollection}/groupings`
    ).subscribe({
      next: (res) => {
        this.availableGroupings.set(res.groupings || []);
      },
      error: () => {}
    });
  }

  useQuery(q: string) {
    this.query = q;
    this.search();
  }

  search() {
    if (!this.query.trim()) return;
    this.loading.set(true);
    this.error.set('');
    this.hasSearched.set(true);
    this.results.set([]);
    this.selectedReferences.clear();
    this.selectedRefItemsMap.clear();

    const payload: any = {
      query: this.query,
      limit: this.limit,
      langue: 'fr',
      filters: [],
    };

    if (this.selectedCollection) {
      payload.collection_name = this.selectedCollection;
    }

    if (this.selectedGrouping) {
      payload.grouping = this.selectedGrouping;
    }

    if (this.selectedLlmModel) {
      payload.model_name = this.selectedLlmModel;
    }

    // Si la recherche rejoue une question deja enregistree (relance depuis
    // l'historique) on renvoie son id : le backend la reutilise au lieu de
    // creer un doublon. Des que le texte change, on repart sur une nouvelle.
    const currentQuestionId = this.questionId();
    if (currentQuestionId !== null && this.query.trim() === this.loadedQuestionText) {
      payload.question_id = currentQuestionId;
    } else {
      this.questionId.set(null);
      this.initialQuestionId = null;
      this.loadedQuestionText = '';
    }

    this.http.post<any>(`${environment.apiUrl}/api/recherche/recherche_simple`, payload).subscribe({
      next: (res) => {
        const hits = res.results ?? res.result_qdrant ?? [];
        this.results.set(hits);
        this.loading.set(false);
        // Capture question_id for jurisprudence saving
        if (this.initialQuestionId) {
          this.questionId.set(this.initialQuestionId);
        } else if (res.question?.id) {
          this.questionId.set(res.question.id);
        }
        this.loadedQuestionText = this.query.trim();
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Erreur de recherche. Veuillez réessayer.');
        this.results.set([]);
        this.loading.set(false);
      }
    });
  }

  // --- Reference Selection Methods for AI Report ---
  isReferenceSelected(id: string): boolean {
    return this.selectedReferences.has(id);
  }

  toggleSelectReference(r: SearchResult) {
    if (this.selectedReferences.has(r.result_id)) {
      this.selectedReferences.delete(r.result_id);
      this.selectedRefItemsMap.delete(r.result_id);
    } else {
      this.selectedReferences.add(r.result_id);
      this.selectedRefItemsMap.set(r.result_id, r);
    }
  }

  isAllSelected(): boolean {
    const raw = this.results();
    return raw.length > 0 && this.selectedReferences.size === raw.length;
  }

  toggleSelectAll() {
    if (this.isAllSelected()) {
      this.selectedReferences.clear();
      this.selectedRefItemsMap.clear();
    } else {
      this.results().forEach(r => {
        this.selectedReferences.add(r.result_id);
        this.selectedRefItemsMap.set(r.result_id, r);
      });
    }
  }

  // --- Enlarged Detail Modal Methods ---
  openDetailModal(r: SearchResult) {
    this.activeDetailResult.set(r);
    document.body.style.overflow = 'hidden';
  }

  closeDetailModal() {
    this.activeDetailResult.set(null);
    if (!this.pdfDrawerOpen() && !this.showReportModal()) {
      document.body.style.overflow = '';
    }
  }

  // --- AI Report Generation Methods ---
  openAiReportModal() {
    if (this.selectedReferences.size === 0) return;
    this.showReportModal.set(true);
    this.reportLoading.set(true);
    this.generatedReport.set('');
    this.copySuccess.set(false);
    this.reportEditMode.set(false);
    this.editedReportHtml.set('');
    this.savedToJurisprudence.set(false);
    this.saveError.set('');
    document.body.style.overflow = 'hidden';

    const contextItems = Array.from(this.selectedRefItemsMap.values());
    const token = this.auth.token() || localStorage.getItem('token') || localStorage.getItem('access_token') || '';
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    const payload = {
      query: this.query,
      context: contextItems,
      model_name: this.selectedLlmModel
    };

    this.http.post<any>(`${environment.apiUrl}/api/recherche/recherche_interpretation`, payload, { headers }).subscribe({
      next: (res) => {
        this.generatedReport.set(res.answer || res.report || 'Rapport généré.');
        this.reportLoading.set(false);
      },
      error: (err) => {
        this.reportLoading.set(false);
        this.generatedReport.set(`Erreur lors de la génération du rapport : ${err.error?.error || 'Erreur serveur.'}`);
      }
    });
  }

  canEditReport(): boolean {
    return this.auth.hasRole(['Administrateur', 'Responsable juridique']);
  }

  toggleReportEditMode() {
    const entering = !this.reportEditMode();
    this.reportEditMode.set(entering);
    if (entering) {
      // Seed editor with current formatted HTML
      this.editedReportHtml.set(this.formatReportHtml(this.generatedReport()));
    }
  }

  onReportEditorInput(event: Event) {
    const el = event.target as HTMLElement;
    this.editedReportHtml.set(el.innerHTML);
  }

  getDisplayHtml(): string {
    if (this.reportEditMode() && this.editedReportHtml()) {
      return this.editedReportHtml();
    }
    return this.formatReportHtml(this.generatedReport());
  }

  saveToJurisprudence() {
    const qId = this.questionId();
    if (!qId) {
      this.saveError.set('Aucune question associée à cette recherche.');
      return;
    }
    this.saveLoading.set(true);
    this.saveError.set('');

    const htmlContent = this.reportEditMode() && this.editedReportHtml()
      ? this.editedReportHtml()
      : this.formatReportHtml(this.generatedReport());

    const token = this.auth.token() || '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    const sources = Array.from(this.selectedReferences);

    const payload = {
      question_id: qId,
      sources: sources,
      content: this.generatedReport(),
      html_content: htmlContent,
      status: 'DRAFT'
    };

    this.http.post<any>(`${environment.apiUrl}/api/jurisprudence/responses`, payload, { headers }).subscribe({
      next: () => {
        this.savedToJurisprudence.set(true);
        this.saveLoading.set(false);
      },
      error: (err) => {
        this.saveError.set(err.error?.error || err.error?.details || 'Erreur lors de la sauvegarde.');
        this.saveLoading.set(false);
      }
    });
  }

  closeAiReportModal() {
    this.showReportModal.set(false);
    if (!this.pdfDrawerOpen() && !this.activeDetailResult()) {
      document.body.style.overflow = '';
    }
  }

  formatReportHtml(text: string): string {
    if (!text) return '';

    // Safeguard HTML special characters
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Remove emojis (unicode ranges for common emoji blocks)
    html = html.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F900}-\u{1F9FF}]/gu, '');

    // Bold formatting
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Parse list items (- or *)
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li class="report-list-item">$1</li>');

    // Section definition (no emoji, professional label mapping)
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

      // Remove stray ### subheaders leftover from LLM
      content = content.replace(/^### (.*)$/gm, '<h5 class="report-subhdr-ref">$1</h5>');
      content = content.replace(/^## (.*)$/gm, '<h5 class="report-subhdr-ref">$1</h5>');

      content = content.replace(/\n\n/g, '</p><p>');
      content = content.replace(/\n/g, '<br>');
      if (content && !content.startsWith('<p>') && !content.startsWith('<h')) {
        content = '<p>' + content + '</p>';
      }

      // Wrap consecutive <li> into <ul>
      content = content.replace(/(<li class="report-list-item">.*?<\/li>)+/g, listBlock =>
        '<ul class="report-ul">' + listBlock + '</ul>'
      );

      if (key === 'TITRE') {
        const titleText = content.replace(/<\/?p>/g, '').replace(/<br>/g, ' ').trim();
        formattedHtml += `
          <div class="report-section-title-block">
            <div class="report-title-label">RAPPORT D'ANALYSE RÉGLEMENTAIRE</div>
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
    const text = this.generatedReport();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 3000);
    });
  }

  printReport() {
    window.print();
  }

  downloadReportPdf() {
    const reportHtml = this.reportEditMode() && this.editedReportHtml()
      ? this.editedReportHtml()
      : this.formatReportHtml(this.generatedReport());
    const date = this.getPrintDate();
    const query = this.query;

    // SVG brand logo (inline, no external file needed in print window)
    const logoSvg = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#0a1f4e"/>
      <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle"
            font-family="Georgia,serif" font-weight="800" font-size="22" fill="#c8842a">L</text>
    </svg>`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport Juridique LEX-IA</title>
  <style>
    @page { size: A4; margin: 18mm 20mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 11pt; color: #1a1a2e; background: #fff; }
    /* ── Header ── */
    .page-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; margin-bottom: 4px; }
    .brand-block { display: flex; align-items: center; gap: 12px; }
    .brand-logo-svg { width: 44px; height: 44px; flex-shrink: 0; }
    .brand-text-col { display: flex; flex-direction: column; gap: 2px; }
    .brand-name { font-size: 20pt; font-weight: 800; color: #0a1f4e; letter-spacing: 1px; line-height: 1; }
    .brand-sub  { font-size: 7pt; font-weight: 700; color: #c8842a; letter-spacing: 2px; text-transform: uppercase; }
    .header-date { font-size: 9pt; color: #6c757d; text-align: right; }
    .header-divider { height: 3px; background: linear-gradient(90deg, #0a1f4e 55%, #c8842a 100%); margin: 8px 0 16px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* ── Question box ── */
    .question-box { background: #f0f4f9; border-left: 4px solid #0a1f4e; padding: 10px 14px; margin-bottom: 22px; font-size: 10.5pt; color: #2c3e50; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .question-box strong { color: #0a1f4e; display: block; margin-bottom: 3px; font-size: 8pt; letter-spacing: 1px; text-transform: uppercase; }
    /* ── Report sections ── */
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
    /* ── Footer ── */
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
    <strong>Question pos&eacute;e</strong>
    ${query}
  </div>
  ${reportHtml}
  <div class="page-footer">
    <span>Rapport g&eacute;n&eacute;r&eacute; par LEX-IA &mdash; Bank Al-Maghrib Compliance Suite</span>
    <span class="confidential">Confidentiel Interne</span>
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

  getPrintDate(): string {
    const d = new Date();
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // --- Formatted Level Header (Label du niveau : Valeur) ---
  getFormattedLevelHeader(r: SearchResult): { label: string; value: string } | null {
    const meta = r.reponse || {};

    // Get document reference / name
    const docName = this.cleanVal(
      meta['reference'] || meta['levelvalue5'] || meta['document'] || meta['doc_name'] || ''
    ).toLowerCase().trim();

    let header: { label: string; value: string } | null = null;

    // Scan levels from 6 down to 1 (highest non-empty level)
    for (let i = 6; i >= 1; i--) {
      const lname = this.cleanVal(meta[`levelname${i}`]);
      const lval = this.cleanVal(meta[`levelvalue${i}`]);
      if (lval) {
        header = { label: lname || `Niveau ${i}`, value: lval };
        break;
      }
    }

    if (!header) {
      if (meta['numero_article']) {
        header = { label: 'Article', value: this.cleanVal(meta['numero_article']) };
      } else if (meta['titre']) {
        header = { label: 'Titre', value: this.cleanVal(meta['titre']) };
      } else if (meta['chapitre']) {
        header = { label: 'Chapitre', value: this.cleanVal(meta['chapitre']) };
      } else if (meta['section']) {
        header = { label: 'Section', value: this.cleanVal(meta['section']) };
      }
    }

    if (!header || !header.value) return null;

    // Suppress header if title value is identical to document name
    const headerValLower = header.value.toLowerCase().trim();
    if (docName && (headerValLower === docName || (docName.includes(headerValLower) && headerValLower.length > docName.length * 0.85))) {
      return null;
    }

    return header;
  }

  getActiveLevelBadges(r: SearchResult): { label: string; value: string }[] {
    const meta = r.reponse || {};
    const badges: { label: string; value: string }[] = [];

    for (let i = 1; i <= 6; i++) {
      const lname = this.cleanVal(meta[`levelname${i}`]);
      const lval = this.cleanVal(meta[`levelvalue${i}`]);
      if (lname && lval) {
        badges.push({ label: lname, value: lval });
      }
    }

    if (badges.length > 0) return badges;

    if (meta['section']) badges.push({ label: 'Section', value: this.cleanVal(meta['section']) });
    if (meta['chapitre']) badges.push({ label: 'Chapitre', value: this.cleanVal(meta['chapitre']) });
    if (meta['numero_article']) badges.push({ label: 'Article', value: this.cleanVal(meta['numero_article']) });
    if (meta['pages']) badges.push({ label: 'Page', value: this.cleanVal(meta['pages']) });

    return badges;
  }

  truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  scoreClass(score: number): string {
    if (score >= 0.8) return 'score-badge score-high';
    if (score >= 0.6) return 'score-badge score-med';
    return 'score-badge score-low';
  }

  openPdf(r: SearchResult) {
    let raw: string = (r.reponse['hyperlink'] || r.reponse['document_url'] || '').trim();
    raw = raw.replace(/\\/g, '/');

    let url = '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      url = raw;
    } else {
      const cleanPath = raw.split('/').filter(Boolean).map(segment => encodeURIComponent(segment)).join('/');
      url = `${environment.apiUrl}/api/documents/pdfs/${cleanPath}`;
    }

    const cardTitle = r.reponse['titre'] || r.reponse['levelvalue6'] || r.reponse['reference'] || '';
    const highlightText = cardTitle || this.query;
    const title = cardTitle || r.reponse['reference'] || r.reponse['levelvalue5'] || raw;
    const pageVal = r.reponse['pages'] || r.reponse['page'] || '';

    this.activePdfUrl.set(url);
    this.activePdfHighlight.set(highlightText);
    this.activePdfTitle.set(title);
    this.activePdfPage.set(pageVal);
    this.pdfDrawerOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  cleanVal(val: any): string {
    if (!val) return '';
    const str = String(val).trim();
    if (str.endsWith('.0') && /^\d+\.0$/.test(str)) {
      return str.slice(0, -2);
    }
    return str;
  }

  closePdf(event?: MouseEvent) {
    if (event && !(event.target as HTMLElement).classList.contains('pdf-drawer-overlay')) return;
    this.pdfDrawerOpen.set(false);
    this.activePdfUrl.set('');
    if (!this.activeDetailResult() && !this.showReportModal()) {
      document.body.style.overflow = '';
    }
  }
}