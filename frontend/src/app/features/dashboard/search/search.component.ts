import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PdfViewerComponent } from './pdf-viewer.component';

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
  template: `
<div class="search-page">
  <!-- Search Hero -->
  <div class="search-hero card animate-fadeInUp">
    <div class="search-bar">
      <input class="search-input" type="text" [(ngModel)]="query"
        placeholder="Ex: Quelles sont les obligations de fonds propres pour une banque ?"
        (keyup.enter)="search()" />
      <button class="filter-toggle-btn"
              (click)="toggleFilters()"
              [class.active]="showFilters() || selectedCollection || selectedGrouping || selectedGroupingMode() !== 'collection'">
        <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        Filtres
        <span class="filter-count-badge" *ngIf="activeFilterCount() > 0">{{ activeFilterCount() }}</span>
      </button>
      <button class="btn btn-primary search-btn" (click)="search()" [disabled]="loading() || !query.trim()">
        <span class="spinner" *ngIf="loading()"></span>
        <ng-container *ngIf="!loading()">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          Rechercher
        </ng-container>
      </button>
    </div>

    <!-- Active filter chips -->
    <div class="filter-chips" *ngIf="!showFilters() && (selectedCollection || selectedGrouping || selectedGroupingMode() !== 'collection')">
      <span class="chip chip-primary" *ngIf="selectedGroupingMode()">
        {{ selectedGroupingMode() === 'collection' ? '📁 Groupe: Collection' : (selectedGroupingMode() === 'document' ? '📄 Groupe: Document' : (selectedGroupingMode() === 'grouping' ? '🏷️ Groupe: Grouping' : '📋 Sans Regroupement')) }}
      </span>
      <span class="chip chip-teal" *ngIf="selectedCollection">
        📁 {{ selectedCollection }}
        <button (click)="selectedCollection = ''; onCollectionChange()" class="chip-close">✕</button>
      </span>
      <span class="chip chip-navy" *ngIf="selectedGrouping" [title]="selectedGrouping">
        📂 {{ formatGrouping(selectedGrouping) }}
        <button (click)="selectedGrouping = ''" class="chip-close">✕</button>
      </span>
    </div>

    <!-- Collapsible Filters Drawer -->
    <div class="filters-row animate-fadeIn" *ngIf="showFilters()">
      <!-- Grouping Mode selector (Default: Collection) -->
      <div class="filter-group">
        <label class="filter-label">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
          Regrouper les résultats par
        </label>
        <select class="filter-select" [ngModel]="selectedGroupingMode()" (ngModelChange)="selectedGroupingMode.set($event)">
          <option value="collection">📁 Collection (Par défaut)</option>
          <option value="document">📄 Document</option>
          <option value="grouping">🏷️ Groupe de documents (Grouping)</option>
          <option value="none">📋 Sans regroupement (Liste à plat)</option>
        </select>
      </div>

      <!-- Collection selector -->
      <div class="filter-group">
        <label class="filter-label">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h16M4 9h16M4 14h10"/></svg>
          Collection
        </label>
        <select class="filter-select" [(ngModel)]="selectedCollection" (ngModelChange)="onCollectionChange()">
          <option value="">Toutes les collections</option>
          <option *ngFor="let col of collections()" [value]="col.name">{{ col.name }}</option>
        </select>
      </div>

      <!-- Grouping selector -->
      <div class="filter-group">
        <label class="filter-label">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="4" rx="1"/><path d="M4 10h16M4 15h12"/></svg>
          Filtre Groupe de documents
        </label>
        <select class="filter-select" [(ngModel)]="selectedGrouping">
          <option value="">Tous les groupes</option>
          <option *ngFor="let g of availableGroupings()" [value]="g" [title]="g">{{ formatGrouping(g) }}</option>
        </select>
      </div>

      <!-- Results limit -->
      <div class="filter-group filter-group-sm">
        <label class="filter-label">Résultats</label>
        <select class="filter-select" [(ngModel)]="limit">
          <option [value]="10">10</option>
          <option [value]="20">20</option>
          <option [value]="50">50</option>
        </select>
      </div>

      <!-- LLM Model selector -->
      <div class="filter-group" *ngIf="llmModels().length > 0">
        <label class="filter-label">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          Modèle LLM
        </label>
        <select class="filter-select" [(ngModel)]="selectedLlmModel">
          <option value="">🤖 Modèle par défaut</option>
          <option *ngFor="let m of llmModels()" [value]="m.name">{{ m.name }} ({{ m.provider }})</option>
        </select>
      </div>
    </div>

    <div class="search-tags" *ngIf="!showFilters()">
      <span class="search-tag" *ngFor="let t of suggestedQueries" (click)="useQuery(t)">{{ t }}</span>
    </div>
  </div>

  <!-- Error -->
  <div class="alert-error" *ngIf="error()">{{ error() }}</div>

  <!-- Results Section -->
  <div class="results-section" *ngIf="results().length > 0">
    <div class="results-header">
      <div class="flex-between" style="width:100%">
        <span class="results-count">{{ results().length }} résultats trouvés ({{ groupedResults().length }} groupe(s))</span>

        <div class="select-all-controls">
          <button class="btn btn-outline btn-xs" (click)="toggleSelectAll()">
            {{ isAllSelected() ? '✕ Tout désélectionner' : '☑️ Tout sélectionner' }}
          </button>
        </div>
      </div>

      <div class="results-meta-badges" style="margin-top:8px">
        <span class="badge badge-primary">
          Regroupement : {{ selectedGroupingMode() === 'collection' ? 'Collection' : (selectedGroupingMode() === 'document' ? 'Document' : (selectedGroupingMode() === 'grouping' ? 'Grouping' : 'Aucun')) }}
        </span>
        <span class="badge badge-teal">Recherche sémantique</span>
        <span class="badge badge-navy" *ngIf="selectedCollection">{{ selectedCollection }}</span>
        <span class="badge badge-light" *ngIf="selectedGrouping" [title]="selectedGrouping">📂 {{ formatGrouping(selectedGrouping) }}</span>
      </div>
    </div>

    <!-- Grouped View (Responsive 3 cards per row inside groups) -->
    <div class="grouped-results-container" *ngIf="selectedGroupingMode() !== 'none'">
      <div class="group-section card animate-fadeInUp"
           *ngFor="let g of groupedResults(); let gi = index; trackBy: trackByGroup"
           [style.animation-delay]="gi * 0.04 + 's'">
        
        <!-- Group Header -->
        <div class="group-header">
          <div class="group-header-left">
            <span class="group-icon-badge">{{ g.icon }}</span>
            <div class="group-header-title-box">
              <h3 class="group-title-text" [title]="g.groupKey">{{ formatGrouping(g.groupKey) }}</h3>
              <span class="group-subtitle">{{ g.count }} extrait(s) pertinent(s)</span>
            </div>
          </div>
          <div class="group-header-right">
            <span class="badge badge-score-max">Score Max: {{ (g.maxScore * 100).toFixed(0) }}%</span>
          </div>
        </div>

        <!-- Group Items Grid (3 cards / line responsive) -->
        <div class="results-grid group-items-grid">
          <div class="result-card inner-result-card card-grid-item"
               *ngFor="let r of g.results; trackBy: trackByResult"
               [class.selected-card]="isReferenceSelected(r.result_id)"
               (click)="openDetailModal(r)">
            
            <div class="card-top-content">
              <div class="result-header">
                <!-- Checkbox for AI Report reference selection -->
                <label class="ref-checkbox-wrapper" (click)="$event.stopPropagation()">
                  <input type="checkbox"
                         [checked]="isReferenceSelected(r.result_id)"
                         (change)="toggleSelectReference(r)" />
                  <span class="checkbox-custom"></span>
                </label>

                <div class="score-badge" [class]="scoreClass(r.score)">
                  {{ (r.score * 100).toFixed(0) }}%
                </div>
                <div class="result-meta-row">
                  <span class="result-law">{{ r.reponse['reference'] || r.reponse['levelvalue5'] || 'Document' }}</span>
                  <div class="result-meta-tags" *ngIf="r.reponse['grouping']">
                    <span class="micro-badge" [title]="r.reponse['grouping']">📂 {{ formatGrouping(r.reponse['grouping']) }}</span>
                  </div>
                </div>
              </div>

              <!-- Formatted Level Header: Label du niveau : Valeur -->
              <div class="level-header-row" *ngIf="getFormattedLevelHeader(r) as lvl">
                <span class="level-lbl-name">{{ lvl.label }} :</span>
                <span class="level-lbl-value">{{ lvl.value }}</span>
              </div>
              <div class="level-header-row" *ngIf="!getFormattedLevelHeader(r)">
                <span class="level-lbl-value">{{ cleanVal(r.reponse['titre'] || r.reponse['levelvalue6']) || '—' }}</span>
              </div>

              <!-- Short Content Snippet (~120 chars) -->
              <p class="result-content-preview">
                {{ truncate(r.reponse['contenu'] || r.reponse['paragraph'] || '', 120) }}
              </p>
            </div>

            <div class="result-footer">
              <div class="result-tags">
                <span class="badge badge-navy" *ngIf="r.reponse['section'] || r.reponse['levelvalue4']">
                  {{ cleanVal(r.reponse['section'] || r.reponse['levelvalue4']) }}
                </span>
                <span class="badge badge-teal" *ngIf="r.reponse['numero_article'] || r.reponse['levelvalue6']">
                  Art. {{ cleanVal(r.reponse['numero_article'] || r.reponse['levelvalue6']) }}
                </span>
                <span class="badge badge-light" *ngIf="r.reponse['pages']">p. {{ cleanVal(r.reponse['pages']) }}</span>
              </div>
              
              <button
                *ngIf="r.reponse['hyperlink'] || r.reponse['document_url']"
                (click)="$event.stopPropagation(); openPdf(r)"
                class="result-link" title="Consulter la source PDF">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                PDF
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>

    <!-- Flat View (3 cards / line responsive) -->
    <div class="results-grid" *ngIf="selectedGroupingMode() === 'none'">
      <div class="result-card card card-grid-item animate-fadeInUp"
           *ngFor="let r of results(); let i = index; trackBy: trackByResult"
           [class.selected-card]="isReferenceSelected(r.result_id)"
           (click)="openDetailModal(r)"
           [style.animation-delay]="i * 0.03 + 's'">
        
        <div class="card-top-content">
          <div class="result-header">
            <!-- Checkbox for AI Report reference selection -->
            <label class="ref-checkbox-wrapper" (click)="$event.stopPropagation()">
              <input type="checkbox"
                     [checked]="isReferenceSelected(r.result_id)"
                     (change)="toggleSelectReference(r)" />
              <span class="checkbox-custom"></span>
            </label>

            <div class="score-badge" [class]="scoreClass(r.score)">
              {{ (r.score * 100).toFixed(0) }}%
            </div>
            <div class="result-meta-row">
              <span class="result-law">{{ r.reponse['reference'] || r.reponse['levelvalue5'] || 'Document' }}</span>
              <div class="result-meta-tags" *ngIf="r.reponse['grouping']">
                <span class="micro-badge" [title]="r.reponse['grouping']">📂 {{ formatGrouping(r.reponse['grouping']) }}</span>
              </div>
            </div>
          </div>

          <!-- Formatted Level Header: Label du niveau : Valeur -->
          <div class="level-header-row" *ngIf="getFormattedLevelHeader(r) as lvl">
            <span class="level-lbl-name">{{ lvl.label }} :</span>
            <span class="level-lbl-value">{{ lvl.value }}</span>
          </div>
          <div class="level-header-row" *ngIf="!getFormattedLevelHeader(r)">
            <span class="level-lbl-value">{{ cleanVal(r.reponse['titre'] || r.reponse['levelvalue6']) || '—' }}</span>
          </div>

          <!-- Short Content Snippet (~120 chars) -->
          <p class="result-content-preview">
            {{ truncate(r.reponse['contenu'] || r.reponse['paragraph'] || '', 120) }}
          </p>
        </div>

        <div class="result-footer">
          <div class="result-tags">
            <span class="badge badge-navy" *ngIf="r.reponse['section'] || r.reponse['levelvalue4']">
              {{ cleanVal(r.reponse['section'] || r.reponse['levelvalue4']) }}
            </span>
            <span class="badge badge-teal" *ngIf="r.reponse['numero_article'] || r.reponse['levelvalue6']">
              Art. {{ cleanVal(r.reponse['numero_article'] || r.reponse['levelvalue6']) }}
            </span>
            <span class="badge badge-light" *ngIf="r.reponse['pages']">p. {{ cleanVal(r.reponse['pages']) }}</span>
          </div>
          
          <button
            *ngIf="r.reponse['hyperlink'] || r.reponse['document_url']"
            (click)="$event.stopPropagation(); openPdf(r)"
            class="result-link" title="Consulter la source PDF">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            PDF
          </button>
        </div>

      </div>
    </div>
  </div>

  <!-- Empty state -->
  <div class="empty-state" *ngIf="!loading() && results().length === 0 && hasSearched()">
    <div class="empty-icon">🔍</div>
    <h3>Aucun résultat trouvé</h3>
    <p>Essayez de reformuler votre question, de changer de collection ou de supprimer les filtres.</p>
  </div>

  <!-- Idle state -->
  <div class="idle-state" *ngIf="!hasSearched() && !loading()">
    <div class="idle-icon">⚖️</div>
    <h3>Prêt pour votre recherche</h3>
    <p>Entrez votre question juridique ci-dessus pour commencer.</p>
  </div>
</div>

<!-- FLOATING ACTION BAR FOR SELECTED REFERENCES & AI REPORT GENERATION -->
<div class="floating-ai-bar animate-fadeInUp" *ngIf="selectedReferences.size > 0">
  <!-- Row 1: Info & Model Select -->
  <div class="floating-row-top">
    <div class="floating-bar-info">
      <div class="floating-icon-box">📌</div>
      <div class="floating-text-box">
        <strong>{{ selectedReferences.size }} référence(s) sélectionnée(s)</strong>
        <span class="floating-sub">Textes inclus dans la synthèse juridique IA</span>
      </div>
    </div>

    <div class="floating-model-group" *ngIf="llmModels().length > 0">
      <span class="floating-model-label">Modèle LLM :</span>
      <select class="floating-model-select" [(ngModel)]="selectedLlmModel">
        <option value="" style="color:#0a1f4e; background:#fff">🤖 Modèle par défaut</option>
        <option *ngFor="let m of llmModels()" [value]="m.name" style="color:#0a1f4e; background:#fff">{{ m.name }}</option>
      </select>
    </div>
  </div>

  <!-- Row 2: Deselect & Primary CTA -->
  <div class="floating-row-bottom">
    <button class="btn btn-floating-ghost" (click)="selectedReferences.clear(); selectedRefItemsMap.clear()">
      Désélectionner tout
    </button>

    <button class="btn btn-floating-generate" (click)="openAiReportModal()" [disabled]="reportLoading()">
      <span class="spinner-sm" *ngIf="reportLoading()"></span>
      <span *ngIf="!reportLoading()">🤖 Générer le Rapport IA ({{ selectedReferences.size }})</span>
    </button>
  </div>
</div>

<!-- ENLARGED CARD DETAIL MODAL -->
<div class="modal-overlay" *ngIf="activeDetailResult()" (click)="closeDetailModal()">
  <div class="modal-box detail-modal-box animate-fadeInUp" (click)="$event.stopPropagation()">
    <div class="modal-header">
      <div class="detail-header-info">
        <div style="display:flex; gap:6px; flex-wrap:wrap">
          <span class="badge badge-teal" *ngIf="activeDetailResult()?.reponse?.['collection']">
            📁 {{ activeDetailResult()?.reponse?.['collection'] }}
          </span>
          <span class="badge badge-navy" *ngIf="activeDetailResult()?.reponse?.['grouping']" [title]="activeDetailResult()?.reponse?.['grouping']">
            📂 {{ formatGrouping(activeDetailResult()?.reponse?.['grouping']) }}
          </span>
        </div>
        <h3>{{ activeDetailResult()?.reponse?.['reference'] || activeDetailResult()?.reponse?.['levelvalue5'] || 'Détails du document' }}</h3>
      </div>
      <button class="modal-close" (click)="closeDetailModal()">✕</button>
    </div>

    <div class="modal-body-content detail-body">
      <!-- Level Header Title -->
      <div class="detail-level-title-banner" *ngIf="getFormattedLevelHeader(activeDetailResult()!) as lvl">
        <span class="level-lbl-name">{{ lvl.label }} :</span>
        <span class="level-lbl-value">{{ lvl.value }}</span>
      </div>

      <!-- Full Untruncated Paragraph Content -->
      <div class="full-content-box">
        <h4 class="full-content-label">Contenu Intégral du Paragraphe :</h4>
        <p class="full-content-text">{{ activeDetailResult()?.reponse?.['contenu'] || activeDetailResult()?.reponse?.['paragraph'] }}</p>
      </div>

      <!-- Complete Metadata Hierarchy -->
      <div class="detail-hierarchy-section">
        <h4 class="full-content-label">Hiérarchie & Métadonnées Légales :</h4>
        <div class="hierarchy-tags-grid">
          <div class="hier-tag-item" *ngFor="let badge of getActiveLevelBadges(activeDetailResult()!)">
            <span class="hier-label">{{ badge.label }} :</span>
            <span class="hier-val">{{ badge.value }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-actions flex-between" style="margin-top:20px; border-top:1px solid var(--border-light); padding-top:16px">
      <div>
        <button
          *ngIf="activeDetailResult()?.reponse?.['hyperlink'] || activeDetailResult()?.reponse?.['document_url']"
          (click)="openPdf(activeDetailResult()!)"
          class="btn btn-outline btn-sm">
          📄 Consulter le document PDF source
        </button>
      </div>

      <div style="display:flex; gap:10px">
        <button class="btn" [class.btn-primary]="!isReferenceSelected(activeDetailResult()?.result_id!)" [class.btn-outline]="isReferenceSelected(activeDetailResult()?.result_id!)"
                (click)="toggleSelectReference(activeDetailResult()!)">
          {{ isReferenceSelected(activeDetailResult()?.result_id!) ? '✓ Référence sélectionnée' : '☑️ Ajouter au Rapport IA' }}
        </button>
        <button class="btn btn-ghost" (click)="closeDetailModal()">Fermer</button>
      </div>
    </div>
  </div>
</div>

<!-- GENERATED AI REPORT MODAL -->
<div class="modal-overlay" *ngIf="showReportModal()" (click)="closeAiReportModal()">
  <div class="modal-box report-modal-box animate-fadeInUp" (click)="$event.stopPropagation()">
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:10px">
        <span style="font-size:24px">🤖</span>
        <div>
          <h3>Rapport d'Analyse Juridique IA</h3>
          <span class="text-muted" style="font-size:12px">Synthèse basée sur {{ selectedReferences.size }} référence(s) sélectionnée(s)</span>
        </div>
      </div>
      <button class="modal-close" (click)="closeAiReportModal()">✕</button>
    </div>

    <div class="modal-body-content report-body">
      <!-- Loading indicator -->
      <div class="report-loading-box" *ngIf="reportLoading()">
        <span class="spinner" style="width:36px; height:36px"></span>
        <h4 style="color:var(--navy); margin-top:14px">Génération du rapport d'analyse par l'IA...</h4>
        <p class="text-muted" style="font-size:13px">Analyse rigoureuse et structurée des articles réglementaires sélectionnés.</p>
      </div>

      <!-- Generated Report Output -->
      <div class="generated-report-text markdown-body" *ngIf="!reportLoading() && generatedReport()">
        <!-- Print Only Header -->
        <div class="print-only-header">
          <div class="print-header-top">
            <img src="assets/logo.png" alt="LEX-IA Logo" class="print-logo" />
            <div class="print-brand-info">
              <span class="print-brand-name">LEX-IA</span>
              <span class="print-brand-sub">CONFORMITÉ &amp; INTELLIGENCE ARTIFICIELLE JURIDIQUE</span>
            </div>
            <div class="print-date">{{ getPrintDate() }}</div>
          </div>
          <div class="print-header-line"></div>
          <div class="print-meta-summary">
            <strong>Question posée :</strong> &ldquo;{{ query }}&rdquo;
          </div>
        </div>

        <!-- Edit mode toolbar (admin / responsable juridique only) -->
        <div class="report-edit-toolbar" *ngIf="canEditReport() && !reportEditMode()">
          <span class="report-edit-hint">Vous pouvez modifier ce rapport avant de le sauvegarder.</span>
          <button class="btn btn-outline btn-sm" (click)="toggleReportEditMode()">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Modifier le rapport
          </button>
        </div>

        <div class="report-edit-toolbar report-edit-active" *ngIf="canEditReport() && reportEditMode()">
          <span class="report-edit-hint editing">Mode édition actif &mdash; cliquez dans le texte pour modifier.</span>
          <button class="btn btn-ghost btn-sm" (click)="toggleReportEditMode()">Annuler</button>
        </div>

        <!-- Static view -->
        <div class="report-content-pre" *ngIf="!reportEditMode()" [innerHTML]="formatReportHtml(generatedReport())"></div>

        <!-- Editable view (contenteditable) -->
        <div class="report-content-pre report-editable"
             *ngIf="reportEditMode()"
             contenteditable="true"
             (input)="onReportEditorInput($event)"
             [innerHTML]="editedReportHtml()">
        </div>

        <!-- Print Only Footer -->
        <div class="print-only-footer">
          <div class="print-footer-line"></div>
          <div class="print-footer-content">
            <span>Rapport généré par LEX-IA | Bank Al-Maghrib Compliance Suite</span>
            <span class="print-page-num">Confidentiel Interne</span>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-actions" style="margin-top:20px; border-top:1px solid var(--border-light); padding-top:16px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between" *ngIf="!reportLoading() && generatedReport()">

      <!-- Left: feedback/status -->
      <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap">
        <span *ngIf="copySuccess()" style="color:#059669; font-size:13px; font-weight:600">✓ Copié !</span>
        <span *ngIf="savedToJurisprudence()" style="color:#059669; font-size:13px; font-weight:600; display:flex; align-items:center; gap:5px">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Sauvegardé en jurisprudence
        </span>
        <span *ngIf="saveError()" style="color:#dc2626; font-size:12px">{{ saveError() }}</span>

        <!-- Save to Jurisprudence button (admin / juridique only) -->
        <button *ngIf="canEditReport() && !savedToJurisprudence()" class="btn btn-save-juri"
                (click)="saveToJurisprudence()"
                [disabled]="saveLoading()">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {{ saveLoading() ? 'Sauvegarde...' : 'Sauvegarder en Jurisprudence' }}
        </button>
      </div>

      <!-- Right: document actions -->
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" (click)="copyReportToClipboard()" title="Copier le texte brut">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copier
        </button>
        <button class="btn btn-outline" (click)="downloadReportPdf()" title="Télécharger en PDF">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Télécharger PDF
        </button>
        <button class="btn btn-outline" (click)="printReport()" title="Imprimer">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimer
        </button>
        <button class="btn btn-primary" (click)="closeAiReportModal()">Fermer</button>
      </div>
    </div>
  </div>
</div>

<!-- PDF Viewer Drawer -->
<div class="pdf-drawer-overlay" [class.open]="pdfDrawerOpen()" (click)="closePdf($event)"></div>
<div class="pdf-drawer" [class.open]="pdfDrawerOpen()">
  <button class="drawer-close" (click)="closePdf()">
    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
  <app-pdf-viewer
    *ngIf="pdfDrawerOpen()"
    [pdfUrl]="activePdfUrl()"
    [highlightText]="activePdfHighlight()"
    [targetPage]="activePdfPage()"
    [title]="activePdfTitle()">
  </app-pdf-viewer>
</div>
  `,
  styles: [`
    .search-page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 80px; }

    .search-hero { padding: 20px; }
    .search-bar { display: flex; gap: 10px; align-items: center; }
    .search-input {
      flex: 1; padding: 12px 18px; border: 2px solid var(--border);
      border-radius: var(--radius); font-size: 14px; font-family: 'Inter', sans-serif;
      transition: var(--transition); outline: none; color: var(--text);
    }
    .search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(0,166,147,.12); }
    .search-btn { padding: 12px 22px; font-size: 14px; white-space: nowrap; }

    .filter-toggle-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 11px 16px; font-size: 13px; background: var(--bg);
      border: 1.5px solid var(--border); color: var(--navy);
      border-radius: var(--radius); cursor: pointer; transition: var(--transition);
      white-space: nowrap; font-weight: 600;
    }
    .filter-toggle-btn:hover, .filter-toggle-btn.active {
      border-color: var(--primary); background: rgba(0,166,147,.08); color: var(--primary-dark);
    }
    .filter-count-badge {
      background: var(--primary); color: #fff; border-radius: 99px;
      font-size: 11px; padding: 1px 7px; font-weight: 700;
    }

    /* FILTERS */
    .filters-row {
      display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end;
      margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-light);
    }
    .filter-group { display: flex; flex-direction: column; gap: 4px; }
    .filter-group-sm { min-width: 90px; }
    .filter-label {
      font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;
      letter-spacing: .5px; display: flex; align-items: center; gap: 4px;
    }
    .filter-select {
      padding: 8px 12px; border: 1.5px solid var(--border); border-radius: 8px;
      font-size: 13px; color: var(--text); background: var(--bg-white);
      outline: none; cursor: pointer; transition: var(--transition); min-width: 170px;
    }
    .filter-select:focus { border-color: var(--primary); }

    /* Filter chips */
    .filter-chips { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-top: 14px; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
    }
    .chip-primary { background: rgba(255,122,0,.15); color: var(--primary-dark); }
    .chip-teal { background: rgba(255,122,0,.1); color: var(--primary-dark); }
    .chip-navy { background: rgba(10,31,78,.1); color: var(--navy); }
    .chip-close {
      background: none; border: none; cursor: pointer; font-size: 11px;
      padding: 0 2px; opacity: 0.7; line-height: 1;
    }
    .chip-close:hover { opacity: 1; }

    .search-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
    .search-tag {
      padding: 5px 12px; background: var(--bg); border: 1px solid var(--border);
      border-radius: 999px; font-size: 12px; color: var(--text-muted); cursor: pointer; transition: var(--transition);
    }
    .search-tag:hover { border-color: var(--primary); color: var(--primary); background: rgba(255,122,0,.08); }

    /* RESULTS */
    .results-header { display: flex; flex-direction: column; margin-bottom: 16px; gap: 6px; }
    .results-count { font-size: 14px; font-weight: 600; color: var(--text-muted); }
    .results-meta-badges { display: flex; gap: 6px; flex-wrap: wrap; }

    /* RESPONSIVE 3-CARD GRID */
    .results-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    @media (max-width: 1150px) {
      .results-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 720px) {
      .results-grid { grid-template-columns: 1fr; }
    }

    .group-items-grid { padding: 16px; background: #fafbfc; }

    /* CARD ITEM STYLES WITH CLICK ENLARGE & TEXT WRAP */
    .card-grid-item {
      display: flex; flex-direction: column; justify-content: space-between;
      border: 1.5px solid var(--border-light); border-radius: 14px; padding: 16px 18px;
      background: #ffffff; transition: all 0.2s ease; cursor: pointer;
      min-height: 220px; position: relative; min-width: 0;
      word-break: break-word; overflow-wrap: break-word; max-width: 100%;
    }
    .card-grid-item:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 28px rgba(10, 31, 78, 0.1);
      border-color: var(--primary);
    }
    .card-grid-item.selected-card {
      border-color: var(--primary);
      background: rgba(255, 122, 0, 0.03);
      box-shadow: 0 0 0 2px rgba(255, 122, 0, 0.25);
    }

    /* CHECKBOX CUSTOM */
    .ref-checkbox-wrapper { display: inline-flex; align-items: center; cursor: pointer; }
    .ref-checkbox-wrapper input { display: none; }
    .checkbox-custom {
      width: 20px; height: 20px; border: 2px solid var(--border);
      border-radius: 6px; background: #fff; display: flex;
      align-items: center; justify-content: center; transition: var(--transition);
    }
    .ref-checkbox-wrapper input:checked + .checkbox-custom {
      background: var(--primary); border-color: var(--primary);
    }
    .ref-checkbox-wrapper input:checked + .checkbox-custom::after {
      content: '✓'; color: #fff; font-size: 13px; font-weight: 700;
    }

    .card-top-content { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }

    .result-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 2px; }
    .score-badge { padding: 3px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 700; white-space: nowrap; margin-left: auto; flex-shrink: 0; }
    .score-high { background: rgba(16,185,129,.12); color: #065f46; }
    .score-med  { background: rgba(245,158,11,.12); color: #92400e; }
    .score-low  { background: rgba(107,114,128,.1); color: #374151; }

    .result-meta-row { display: flex; flex-direction: column; gap: 2px; overflow: hidden; flex: 1; min-width: 0; }
    .result-law { font-size: 12.5px; font-weight: 700; color: var(--primary-dark); word-break: break-word; overflow-wrap: break-word; white-space: normal; line-height: 1.35; }

    /* LEVEL HEADER ROW: Label du niveau : Valeur with Text Wrap */
    .level-header-row {
      display: flex; align-items: flex-start; gap: 6px; flex-wrap: wrap;
      font-size: 13.5px; font-weight: 700; color: var(--navy); margin-bottom: 2px;
      word-break: break-word; overflow-wrap: break-word; max-width: 100%;
    }
    .level-lbl-name { color: var(--primary-dark); font-weight: 700; flex-shrink: 0; }
    .level-lbl-value { color: var(--navy); font-weight: 800; word-break: break-word; overflow-wrap: break-word; flex: 1; min-width: 0; }

    .result-content-preview {
      font-size: 12.5px; color: var(--text-muted); line-height: 1.55; margin: 0;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }

    .micro-badge {
      font-size: 10px; padding: 2px 6px; border-radius: 99px;
      background: var(--bg); border: 1px solid var(--border-light); color: var(--text-muted);
    }
    .micro-badge-col { background: rgba(255,122,0,.08); border-color: rgba(255,122,0,.15); color: var(--primary-dark); }

    .result-footer {
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border-light);
    }
    .result-tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .result-link {
      display: inline-flex; align-items: center; gap: 4px; font-size: 11px;
      color: var(--primary); text-decoration: none; font-weight: 600;
      padding: 3px 8px; border: 1px solid var(--primary-light); border-radius: 6px;
      transition: var(--transition); background: transparent; cursor: pointer; white-space: nowrap;
    }
    .result-link:hover { background: rgba(255,122,0,.1); }
    .badge-light { background: var(--bg); border: 1px solid var(--border); color: var(--text-muted); }

    /* FLOATING ACTION BAR */
    .floating-ai-bar {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      width: calc(100% - 60px); max-width: 820px; z-index: 800;
      background: rgba(10, 31, 78, 0.95); backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 16px;
      padding: 14px 24px; color: #ffffff; display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35); gap: 16px;
    }
    .floating-bar-info { display: flex; align-items: center; gap: 14px; }
    .floating-icon { font-size: 24px; }
    .floating-bar-info strong { display: block; font-size: 14px; font-weight: 700; color: #ffffff; }
    .floating-sub { font-size: 11.5px; color: rgba(255, 255, 255, 0.7); display: block; }
    .floating-bar-actions { display: flex; align-items: center; gap: 10px; }

    @media (max-width: 768px) {
      .floating-ai-bar {
        width: calc(100% - 24px);
        bottom: 12px;
        padding: 12px 16px;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .floating-bar-actions {
        flex-wrap: wrap;
        justify-content: space-between;
        width: 100%;
      }
    }

    /* MODALS WITH OVERSCROLL CONTAINMENT */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55);
      z-index: 1000; display: flex; align-items: center; justify-content: center;
      padding: 20px; backdrop-filter: blur(4px); overscroll-behavior: contain;
    }
    .modal-box {
      background: #ffffff; border-radius: 20px; padding: 28px;
      box-shadow: 0 20px 50px rgba(10, 31, 78, 0.25);
      display: flex; flex-direction: column; max-height: 90vh; overflow: hidden;
      overscroll-behavior: contain;
    }
    @media (max-width: 768px) {
      .modal-box {
        padding: 18px 16px;
        max-height: 94vh;
        border-radius: 14px;
      }
      .modal-overlay { padding: 10px; }
    }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .modal-close {
      background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted);
      width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      transition: background 0.15s ease;
    }
    .modal-close:hover { background: rgba(239, 68, 68, 0.1); color: #dc2626; }
    .modal-body-content { overflow-y: auto; flex: 1; padding-right: 4px; overscroll-behavior: contain; }

    /* DETAIL MODAL */
    .detail-modal-box { max-width: 680px; width: 90%; }
    .detail-header-info { display: flex; flex-direction: column; gap: 4px; }
    .detail-header-info h3 { font-size: 17px; color: var(--navy); margin: 4px 0 0 0; }
    .detail-level-title-banner {
      background: rgba(0, 166, 147, 0.08); border-left: 4px solid var(--primary);
      padding: 10px 14px; border-radius: 6px; font-size: 15px; font-weight: 700;
      margin-bottom: 16px; color: var(--navy);
    }
    .full-content-box { margin-bottom: 18px; }
    .full-content-label { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px; }
    .full-content-text {
      font-size: 13.5px; color: var(--text); line-height: 1.7; background: var(--bg);
      padding: 16px; border-radius: 10px; border: 1px solid var(--border-light); white-space: pre-line;
    }
    .hierarchy-tags-grid { display: flex; gap: 8px; flex-wrap: wrap; }
    .hier-tag-item {
      padding: 4px 10px; background: rgba(10,31,78,.05); border: 1px solid rgba(10,31,78,.1);
      border-radius: 8px; font-size: 12px;
    }
    .hier-label { font-weight: 700; color: var(--navy); margin-right: 4px; }
    .hier-val { color: var(--text); }

    /* REPORT MODAL */
    .report-modal-box { max-width: 820px; width: 92%; }
    .report-loading-box { text-align: center; padding: 60px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .report-content-pre {
      font-size: 14.5px; line-height: 1.75; color: var(--text); background: var(--bg);
      padding: 24px; border-radius: 14px; border: 1px solid var(--border-light);
      max-height: 540px; overflow-y: auto; overscroll-behavior: contain;
      display: flex; flex-direction: column; gap: 20px;
    }
    
    /* RICH FORMATTING FOR REPORT */
    .report-section-title-block {
      background: linear-gradient(135deg, var(--navy) 0%, #1a3a7a 100%);
      padding: 24px; border-radius: 12px; color: #ffffff; display: flex; align-items: center; gap: 16px;
      margin-bottom: 8px; box-shadow: 0 4px 12px rgba(10,31,78,0.12);
    }
    .report-main-icon { font-size: 32px; }
    .report-main-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #ffffff; margin: 0; }
    
    .report-card-section {
      background: #ffffff; border: 1.5px solid var(--border-light); border-radius: 12px;
      padding: 20px; box-shadow: 0 2px 8px rgba(10,31,78,0.03);
      border-left: 4.5px solid var(--border); transition: transform 0.2s;
    }
    .report-card-section:hover { transform: translateY(-1px); }
    .report-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-light); }
    .report-card-icon { font-size: 20px; }
    .report-card-header h4 { font-size: 15px; font-weight: 700; color: var(--navy); margin: 0; }
    .report-card-body { font-size: 13.5px; color: var(--text); line-height: 1.7; }
    .report-card-body p { margin: 0 0 12px 0; }
    .report-card-body p:last-child { margin-bottom: 0; }
    
    /* Section specific borders */
    .report-section-executive { border-left-color: #ff7a00; background: rgba(255,122,0,0.015); }
    .report-section-detail { border-left-color: var(--navy); }
    .report-section-impacts { border-left-color: #ef4444; background: rgba(239,68,68,0.015); }
    .report-section-limits { border-left-color: #f59e0b; background: rgba(245,158,11,0.015); }
    .report-section-conclusion { border-left-color: var(--primary); background: rgba(0,166,147,0.015); }
    
    /* Lists style */
    .report-ul { margin: 8px 0 12px 20px; padding: 0; list-style: none; }
    .report-list-item { position: relative; padding-left: 14px; margin-bottom: 6px; font-size: 13.5px; line-height: 1.6; }
    .report-list-item::before {
      content: '•'; color: var(--primary); font-size: 16px; position: absolute; left: 0; top: -1px;
    }
    .report-card-body strong { color: var(--navy); font-weight: 700; }

    /* PRINT SPECIFIC STYLES (HIDDEN BY DEFAULT ON SCREEN) */
    .print-only-header, .print-only-footer { display: none; }
    .print-header-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .print-logo { width: 44px; height: 44px; object-fit: contain; }
    .print-brand-info { display: flex; flex-direction: column; flex: 1; }
    .print-brand-name { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 800; color: #0a1f4e; letter-spacing: 0.5px; }
    .print-brand-sub { font-size: 10px; font-weight: 700; color: #6c757d; letter-spacing: 1px; }
    .print-date { font-size: 11px; color: #6c757d; text-align: right; }
    .print-header-line { height: 2px; background: linear-gradient(90deg, #0a1f4e 0%, #ff7a00 100%); margin: 12px 0; }
    .print-meta-summary { background: #f8f9fa; padding: 12px 16px; border: 1px dashed #ced4da; border-radius: 8px; font-size: 13px; color: #495057; line-height: 1.5; margin-bottom: 24px; }
    .print-footer-line { height: 1px; background: #dee2e6; margin: 16px 0 8px 0; }
    .print-footer-content { display: flex; justify-content: space-between; font-size: 10px; color: #6c757d; font-weight: 600; }
    
    @media print {
      /* Print Setup */
      @page { size: A4; margin: 20mm; }
      
      /* Hide all UI containers */
      body, html { background: #ffffff !important; color: #000000 !important; }
      body * { visibility: hidden; }
      
      /* Show only report elements */
      .modal-overlay,
      .report-modal-box,
      .report-body,
      .generated-report-text,
      .generated-report-text * {
        visibility: visible !important;
        display: block !important;
      }
      
      /* Reset overlay positioning to print flat */
      .modal-overlay {
        position: absolute !important;
        inset: 0 !important;
        background: #ffffff !important;
        padding: 0 !important;
        backdrop-filter: none !important;
        display: block !important;
      }
      
      .report-modal-box {
        max-width: 100% !important;
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border: none !important;
        background: #ffffff !important;
      }
      
      /* Hide buttons & scrollbars */
      .modal-header, .modal-actions { display: none !important; }
      
      .report-content-pre {
        border: none !important;
        padding: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        background: #ffffff !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 20px !important;
      }
      
      /* Print-only elements visibility */
      .print-only-header {
        display: block !important;
        margin-bottom: 24px !important;
      }
      .print-only-footer {
        display: block !important;
        margin-top: 36px !important;
      }
      
      /* Card items printing optimized */
      .report-card-section {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        border: 1px solid #ced4da !important;
        border-left: 5px solid var(--border) !important;
        box-shadow: none !important;
        margin-bottom: 18px !important;
        background: #ffffff !important;
        padding: 16px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .report-section-title-block {
        background: #0a1f4e !important;
        color: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        padding: 18px !important;
        box-shadow: none !important;
        margin-bottom: 16px !important;
        border-radius: 8px !important;
      }
      .report-main-title {
        color: #ffffff !important;
      }
    }

    /* GROUPED RESULTS CONTAINER */
    .grouped-results-container { display: flex; flex-direction: column; gap: 24px; }
    .group-section { padding: 0; overflow: hidden; border: 1px solid var(--border-light); border-radius: 16px; }
    .group-header {
      padding: 16px 20px; background: rgba(10, 31, 78, 0.03);
      border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between;
    }
    .group-header-left { display: flex; align-items: center; gap: 12px; }
    .group-icon-badge {
      font-size: 20px; display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; background: #ffffff; border-radius: 10px;
      box-shadow: var(--shadow-sm); border: 1px solid var(--border-light);
    }
    .group-header-title-box { display: flex; flex-direction: column; }
    .group-title-text { font-size: 15px; font-weight: 700; color: var(--navy); margin: 0; }
    .group-subtitle { font-size: 12px; color: var(--text-muted); }
    .badge-score-max { background: var(--navy); color: #ffffff; font-size: 11px; }

    .alert-error {
      background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.2);
      color: #dc2626; padding: 14px 18px; border-radius: 10px; font-size: 14px;
    }

    /* STATES */
    .empty-state, .idle-state {
      text-align: center; padding: 80px 32px;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
    }
    .empty-icon, .idle-icon { font-size: 56px; margin-bottom: 8px; }
    .empty-state h3, .idle-state h3 { color: var(--navy); }
    .empty-state p, .idle-state p { color: var(--text-muted); font-size: 14px; }

    /* PDF DRAWER WITH OVERSCROLL CONTAINMENT */
    .pdf-drawer-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0); z-index: 900;
      pointer-events: none; transition: background .3s; overscroll-behavior: contain;
    }
    .pdf-drawer-overlay.open { background: rgba(0,0,0,.45); pointer-events: all; }
    .pdf-drawer {
      position: fixed; top: 0; right: -55vw; bottom: 0; width: 52vw; min-width: 360px; max-width: 840px;
      z-index: 901; background: #1a1a2e;
      box-shadow: -8px 0 48px rgba(0,0,0,.4);
      transition: right .35s cubic-bezier(.4,0,.2,1);
      display: flex; flex-direction: column; overflow: hidden;
      overscroll-behavior: contain;
    }
    .pdf-drawer.open { right: 0; }
    .drawer-close {
      position: absolute; top: 10px; right: 12px; z-index: 10;
      background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
      color: #fff; border-radius: 8px; width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background .15s;
    }
    .drawer-close:hover { background: rgba(239,68,68,.3); }
    app-pdf-viewer {
      flex: 1; display: flex; flex-direction: column; height: 100%;
      min-height: 0; overflow: hidden; overscroll-behavior: contain;
    }
  `]
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
    this.http.get<any>('http://127.0.0.1:5000/api/documents/vector-collections').subscribe({
      next: (res) => {
        const cols = res.collections || [];
        this.collections.set(cols);
      },
      error: () => {}
    });
  }

  loadLlmModels() {
    this.http.get<LLMModelOption[]>('http://127.0.0.1:5000/api/llm_models/llm-models/active').subscribe({
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
      `http://127.0.0.1:5000/api/documents/db/collections/${this.selectedCollection}/groupings`
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

    this.http.post<any>('http://127.0.0.1:5000/api/recherche/recherche_simple', payload).subscribe({
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

    this.http.post<any>('http://127.0.0.1:5000/api/recherche/recherche_interpretation', payload, { headers }).subscribe({
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

    this.http.post<any>('http://127.0.0.1:5000/api/jurisprudence/responses', payload, { headers }).subscribe({
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
      url = `http://127.0.0.1:5000/api/documents/pdfs/${cleanPath}`;
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
