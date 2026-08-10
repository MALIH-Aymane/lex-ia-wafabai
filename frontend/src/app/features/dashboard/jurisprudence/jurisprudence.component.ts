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
  template: `
<div class="juri-page">

  <!-- HERO SEARCH HEADER -->
  <div class="search-hero card animate-fadeInUp">
    <div class="hero-top-row">
      <div class="hero-brand">
        <span class="hero-icon">⚖️</span>
        <div>
          <h2>Jurisprudence & Précédents Juridiques</h2>
          <p *ngIf="canManage()">Gérez, modifiez et publiez les réponses juridiques validées.</p>
          <p *ngIf="!canManage()">Consultez les réponses et avis juridiques officiels validés.</p>
        </div>
      </div>

      <!-- Add New Response (Admin / Responsable Juridique only) -->
      <button class="btn btn-primary btn-add-juri" *ngIf="canManage()" (click)="showNewModal.set(true)">
        + Nouvelle réponse
      </button>
    </div>

    <div class="search-box">
      <div class="search-input-wrapper">
        <svg class="search-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          class="search-input"
          placeholder="Posez une question juridique ou saisissez des mots-clés..."
          [(ngModel)]="query"
          (keyup.enter)="search()"
        />
        <button class="btn btn-primary btn-search" (click)="search()" [disabled]="loading()">
          <span class="spinner-sm" *ngIf="loading()"></span>
          <span *ngIf="!loading()">Rechercher</span>
        </button>
      </div>

      <!-- Quick Query Chips -->
      <div class="suggested-chips">
        <span class="suggest-label">Suggestions :</span>
        <button class="chip-tag" *ngFor="let q of suggestedQueries" (click)="useQuery(q)">
          {{ q }}
        </button>
      </div>
    </div>
  </div>

  <!-- RESULTS BAR & FILTERS -->
  <div class="results-bar animate-fadeInUp" *ngIf="hasSearched() || results().length > 0">
    <div class="results-info">
      <span class="results-count"><strong>{{ filteredResults().length }}</strong> jurisprudence(s) disponible(s)</span>
      <span class="query-badge" *ngIf="query">Recherche : « {{ query }} »</span>
    </div>

    <!-- Status Filter (Admin & Legal Manager) -->
    <div class="status-filters" *ngIf="canManage()">
      <button class="filter-tab" [class.active]="statusFilter() === 'ALL'" (click)="statusFilter.set('ALL')">Toutes</button>
      <button class="filter-tab" [class.active]="statusFilter() === 'PUBLISHED'" (click)="statusFilter.set('PUBLISHED')">Publiées</button>
      <button class="filter-tab" [class.active]="statusFilter() === 'DRAFT'" (click)="statusFilter.set('DRAFT')">Brouillons</button>
      <button class="filter-tab" [class.active]="statusFilter() === 'ARCHIVED'" (click)="statusFilter.set('ARCHIVED')">Archivées</button>
    </div>
  </div>

  <!-- REQUEST FEEDBACK SUCCESS BANNER -->
  <div class="request-success-alert animate-fadeInUp" *ngIf="requestSuccess()">
    <div style="display:flex; align-items:center; gap:10px">
      <span style="font-size:20px">✓</span>
      <div>
        <strong>Demande transmise au Responsable Juridique !</strong>
        <p style="margin:2px 0 0; font-size:12.5px; opacity:0.9">Votre question a été enregistrée. L'équipe juridique examinera votre demande et rédigera la réponse de conformité.</p>
      </div>
    </div>
  </div>

  <!-- LOADING STATE -->
  <div class="loading-state" *ngIf="loading()">
    <span class="spinner" style="width:40px; height:40px"></span>
    <h4>Recherche vectorielle dans la jurisprudence marocaine...</h4>
    <p>Analyse de la similarité sémantique des questions répertoriées.</p>
  </div>

  <!-- RESULTS GRID (3-CARD LAYOUT) -->
  <div class="juri-grid" *ngIf="!loading() && filteredResults().length > 0">
    <div class="juri-card card card-hover animate-fadeInUp"
         *ngFor="let item of filteredResults(); let i = index"
         [style.animation-delay]="i * 0.05 + 's'"
         (click)="openDetailModal(item)">

      <div class="juri-card-header">
        <span class="score-badge" [class]="getScoreClass(item.score)">
          {{ getScorePercentage(item.score) }} pertinence
        </span>
        <span class="badge" [class]="statusBadge(item.reponse.status || 'DRAFT')">
          {{ item.reponse.status || 'DRAFT' }}
        </span>
      </div>

      <h4 class="juri-question">
        {{ item.reponse.question || ('Jurisprudence #' + (item.reponse.question_id || item.result_id)) }}
      </h4>

      <p class="juri-excerpt">
        {{ truncateText(item.reponse.content || '', 220) }}
      </p>

      <div class="juri-card-footer">
        <div class="footer-meta">
          <span class="meta-item">📅 {{ formatDate(item.reponse.created_at) }}</span>
          <span class="meta-item">📎 {{ getSourcesCount(item.reponse.sources) }} source(s)</span>
        </div>
        <button class="btn btn-outline btn-xs" (click)="$event.stopPropagation(); openDetailModal(item)">
          Consulter le Rapport
        </button>
      </div>
    </div>
  </div>

  <!-- SIMPLE USER LEGAL REQUEST CALLOUT CARD -->
  <div class="legal-request-card card animate-fadeInUp" *ngIf="!canManage() && !loading()">
    <div class="request-card-body">
      <div class="request-icon">📩</div>
      <div class="request-info">
        <h4>Vous ne trouvez pas la réponse exacte à votre question ?</h4>
        <p>Transmettez directement votre question au <strong>Responsable Juridique</strong>. Elle sera étudiée et ajoutée à la base de jurisprudence après validation.</p>
      </div>
      <button class="btn btn-primary btn-submit-req" (click)="submitQuestionToLegal()" [disabled]="requestSubmitting() || !query.trim()">
        <span class="spinner-sm" *ngIf="requestSubmitting()"></span>
        <span *ngIf="!requestSubmitting()">Demander l'avis au Responsable Juridique</span>
      </button>
    </div>
  </div>

  <!-- EMPTY STATE -->
  <div class="empty-state card" *ngIf="!loading() && filteredResults().length === 0">
    <div class="empty-icon">⚖️</div>
    <h3>Aucune jurisprudence trouvée</h3>
    <p *ngIf="hasSearched()">Aucun précédent juridique ne correspond à votre recherche.</p>
    <p *ngIf="!hasSearched()">Saisissez une question dans la barre ci-dessus pour lancer la recherche.</p>
  </div>


  <!-- FULL JURISPRUDENCE REPORT DETAIL MODAL -->
  <div class="modal-overlay" *ngIf="activeDetailItem()" (click)="closeDetailModal()">
    <div class="modal-box report-modal-box animate-fadeInUp" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <div style="display:flex; align-items:center; gap:12px">
          <div class="modal-icon-badge">⚖️</div>
          <div>
            <h3 style="margin:0; font-size:18px; color:var(--navy)">Rapport de Jurisprudence Validé</h3>
            <span class="text-muted" style="font-size:12px">Précédent réglementaire répertorié dans la base</span>
          </div>
        </div>
        <button class="modal-close" (click)="closeDetailModal()">✕</button>
      </div>

      <div class="modal-body-content report-body">
        <!-- Question banner -->
        <div class="juri-question-banner">
          <span class="q-label">QUESTION POSÉE</span>
          <h4 class="q-text">« {{ activeDetailItem()?.reponse?.question || 'Question juridique' }} »</h4>
          <div class="q-meta">
            <span class="badge" [class]="statusBadge(activeDetailItem()?.reponse?.status || 'DRAFT')">
              {{ activeDetailItem()?.reponse?.status || 'DRAFT' }}
            </span>
            <span>📅 {{ formatDate(activeDetailItem()?.reponse?.created_at) }}</span>
            <span>📎 {{ getSourcesCount(activeDetailItem()?.reponse?.sources) }} référence(s) liée(s)</span>
          </div>
        </div>

        <!-- Management Toolbar (Admin & Responsable Juridique only) -->
        <div class="admin-manage-bar" *ngIf="canManage()">
          <span class="manage-title">Gestion de la jurisprudence :</span>
          <div class="manage-actions">
            <button class="btn btn-xs"
                    [class.btn-primary]="activeDetailItem()?.reponse?.status !== 'PUBLISHED'"
                    [class.btn-outline]="activeDetailItem()?.reponse?.status === 'PUBLISHED'"
                    (click)="changeStatus(activeDetailItem()!, 'PUBLISHED')">
              ✓ {{ activeDetailItem()?.reponse?.status === 'PUBLISHED' ? 'Publiée' : 'Publier' }}
            </button>
            <button class="btn btn-outline btn-xs"
                    *ngIf="activeDetailItem()?.reponse?.status !== 'DRAFT'"
                    (click)="changeStatus(activeDetailItem()!, 'DRAFT')">
              Mettre en Brouillon
            </button>
            <button class="btn btn-outline btn-xs"
                    *ngIf="activeDetailItem()?.reponse?.status !== 'ARCHIVED'"
                    (click)="changeStatus(activeDetailItem()!, 'ARCHIVED')">
              Archiver
            </button>
            <button class="btn btn-danger-ghost btn-xs" (click)="deleteJurisprudence(activeDetailItem()!)">
              🗑️ Supprimer
            </button>
          </div>
        </div>

        <!-- Report content -->
        <div class="report-content-pre" [innerHTML]="getFormattedReportContent(activeDetailItem()!)"></div>
      </div>

      <!-- Action Footer -->
      <div class="modal-actions" style="margin-top:20px; border-top:1px solid var(--border-light); padding-top:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px">
        <div class="copy-status" *ngIf="copySuccess()">
          <span style="color:#059669; font-size:13px; font-weight:600">✓ Copié dans le presse-papier !</span>
        </div>

        <div style="display:flex; gap:8px; margin-left:auto; align-items:center">
          <button class="btn btn-ghost btn-sm" (click)="copyReportToClipboard()" title="Copier le texte">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copier
          </button>
          <button class="btn btn-outline" (click)="downloadReportPdf()" title="Télécharger en PDF">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Télécharger PDF
          </button>
          <button class="btn btn-outline" (click)="printReport()" title="Imprimer">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Imprimer
          </button>
          <button class="btn btn-primary" (click)="closeDetailModal()">Fermer</button>
        </div>
      </div>
    </div>
  </div>

  <!-- NEW RESPONSE CREATION MODAL (Admin / Responsable Juridique only) -->
  <div class="modal-overlay" *ngIf="showNewModal()" (click)="showNewModal.set(false)">
    <div class="modal-box animate-fadeInUp" (click)="$event.stopPropagation()" style="max-width:540px">
      <div class="modal-header">
        <h3 style="font-size:18px; color:var(--navy); margin:0">Nouvelle Réponse Juridique</h3>
        <button class="modal-close" (click)="showNewModal.set(false)">✕</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px; margin-top:16px">
        <div class="form-group">
          <label class="form-label" style="font-weight:600; font-size:13px">ID de la question</label>
          <input class="form-control" type="number" [(ngModel)]="newForm.question_id" placeholder="Ex: 42" style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid var(--border)" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:600; font-size:13px">Contenu de la réponse</label>
          <textarea class="form-control" rows="5" [(ngModel)]="newForm.content" placeholder="Saisissez la réponse juridique..." style="width:100%; padding:10px 12px; border-radius:8px; border:1px solid var(--border); resize:vertical"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:600; font-size:13px">Statut de la publication</label>
          <select class="form-control" [(ngModel)]="newForm.status" style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid var(--border)">
            <option value="DRAFT">Brouillon</option>
            <option value="PUBLISHED">Publié</option>
            <option value="ARCHIVED">Archivé</option>
          </select>
        </div>
      </div>

      <div class="modal-actions" style="margin-top:24px; display:flex; justify-content:flex-end; gap:10px">
        <button class="btn btn-ghost" (click)="showNewModal.set(false)">Annuler</button>
        <button class="btn btn-primary" (click)="submitNewResponse()">Publier la réponse</button>
      </div>
    </div>
  </div>

</div>
  `,
  styles: [`
    .juri-page { display: flex; flex-direction: column; gap: 20px; }

    /* HERO SEARCH CARD */
    .search-hero {
      padding: 24px 28px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg, 16px);
    }
    .hero-top-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .hero-brand { display: flex; align-items: center; gap: 14px; }
    .hero-icon { font-size: 32px; }
    .hero-brand h2 { font-size: 22px; font-weight: 700; color: var(--navy, #0a1f4e); margin-bottom: 4px; }
    .hero-brand p { font-size: 13.5px; color: var(--text-muted, #64748b); margin: 0; }
    .btn-add-juri { white-space: nowrap; flex-shrink: 0; }

    /* SEARCH INPUT */
    .search-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-icon {
      position: absolute;
      left: 16px;
      color: var(--text-muted, #94a3b8);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      padding: 14px 130px 14px 48px;
      border: 2px solid var(--border-light, #e2e8f0);
      border-radius: 12px;
      font-size: 14.5px;
      color: var(--text, #1e293b);
      background: #ffffff;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .search-input:focus {
      border-color: var(--primary, #ff7a00);
      box-shadow: 0 0 0 4px rgba(255, 122, 0, 0.12);
    }
    .btn-search {
      position: absolute;
      right: 6px;
      padding: 9px 20px;
      border-radius: 8px;
    }

    /* SUGGESTED CHIPS */
    .suggested-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
    .suggest-label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
    .chip-tag {
      padding: 4px 12px;
      background: rgba(10, 31, 78, 0.05);
      border: 1px solid rgba(10, 31, 78, 0.1);
      border-radius: 999px;
      font-size: 12px;
      color: var(--navy);
      cursor: pointer;
      transition: all 0.15s;
    }
    .chip-tag:hover {
      background: var(--navy);
      color: #ffffff;
      border-color: var(--navy);
    }

    /* RESULTS BAR */
    .results-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 0 4px;
    }
    .results-count { font-size: 14px; color: var(--text-muted); }
    .query-badge {
      display: inline-block;
      margin-left: 10px;
      padding: 3px 10px;
      background: rgba(255, 122, 0, 0.1);
      color: var(--primary-dark, #c8842a);
      border-radius: 6px;
      font-size: 12.5px;
      font-weight: 600;
    }
    .status-filters { display: flex; gap: 4px; background: #e2e8f0; padding: 3px; border-radius: 8px; }
    .filter-tab {
      padding: 5px 14px;
      border: none;
      background: transparent;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-muted);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .filter-tab.active { background: #ffffff; color: var(--navy); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

    /* ALERT BANNER */
    .request-success-alert {
      background: #ecfdf5; border: 1.5px solid #a7f3d0; color: #065f46;
      padding: 14px 18px; border-radius: 12px; font-size: 13.5px;
    }

    /* LOADING STATE */
    .loading-state {
      text-align: center;
      padding: 60px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .loading-state h4 { color: var(--navy); font-size: 16px; margin: 0; }
    .loading-state p { color: var(--text-muted); font-size: 13px; margin: 0; }

    /* GRID LAYOUT */
    .juri-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
    }
    @media (max-width: 1100px) { .juri-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 700px)  { .juri-grid { grid-template-columns: 1fr; } }

    .juri-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      border: 1.5px solid var(--border-light, #e2e8f0);
      border-radius: 14px;
      background: #ffffff;
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
      cursor: pointer;
    }
    .juri-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 25px rgba(10, 31, 78, 0.08);
      border-color: var(--primary, #ff7a00);
    }
    .juri-card-header { display: flex; align-items: center; justify-content: space-between; }

    .score-badge { padding: 3px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 700; }
    .score-high { background: rgba(16,185,129,.12); color: #065f46; }
    .score-med  { background: rgba(245,158,11,.12); color: #92400e; }
    .score-low  { background: rgba(107,114,128,.1); color: #374151; }

    .juri-question {
      font-size: 15px;
      font-weight: 700;
      color: var(--navy, #0a1f4e);
      line-height: 1.4;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .juri-excerpt {
      font-size: 13px;
      color: var(--text-muted, #64748b);
      line-height: 1.6;
      flex: 1;
      margin: 0;
    }

    .juri-card-footer {
      border-top: 1px solid var(--border-light, #f1f5f9);
      padding-top: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .footer-meta { display: flex; flex-direction: column; gap: 2px; }
    .meta-item { font-size: 11.5px; color: var(--text-light, #94a3b8); }

    /* SIMPLE USER LEGAL REQUEST CALLOUT CARD */
    .legal-request-card {
      background: linear-gradient(135deg, rgba(10,31,78,0.03) 0%, rgba(200,132,42,0.06) 100%);
      border: 1.5px dashed var(--primary, #ff7a00);
      border-radius: 16px;
      padding: 20px 24px;
      margin-top: 12px;
    }
    .request-card-body { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
    .request-icon { font-size: 32px; flex-shrink: 0; }
    .request-info { flex: 1; min-width: 250px; }
    .request-info h4 { margin: 0 0 4px 0; color: var(--navy); font-size: 15.5px; font-weight: 700; }
    .request-info p { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
    .btn-submit-req { white-space: nowrap; flex-shrink: 0; }

    /* ADMIN MANAGEMENT TOOLBAR */
    .admin-manage-bar {
      display: flex; align-items: center; justify-content: space-between;
      background: rgba(10,31,78,0.04); border: 1px solid rgba(10,31,78,0.1);
      padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; gap: 10px; flex-wrap: wrap;
    }
    .manage-title { font-size: 12.5px; font-weight: 700; color: var(--navy); }
    .manage-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .btn-danger-ghost {
      background: transparent; color: #dc2626; border: 1px solid rgba(220,38,38,0.3);
      &:hover { background: rgba(220,38,38,0.08); }
    }

    /* STATUS BADGES */
    .badge-DRAFT     { background: rgba(107,114,128,.1); color: #374151; }
    .badge-PUBLISHED { background: rgba(16,185,129,.12); color: #065f46; }
    .badge-ARCHIVED  { background: rgba(245,158,11,.12); color: #92400e; }

    /* EMPTY STATE */
    .empty-state { text-align: center; padding: 70px 20px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .empty-icon { font-size: 50px; }
    .empty-state h3 { color: var(--navy); font-size: 18px; margin: 0; }
    .empty-state p { color: var(--text-muted); font-size: 13.5px; margin: 0; max-width: 440px; }

    /* MODAL STYLES */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(10,31,78,.45);
      backdrop-filter: blur(4px); z-index: 999;
      display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .report-modal-box {
      width: 100%; max-width: 900px; max-height: 90vh;
      display: flex; flex-direction: column; background: #ffffff;
      border-radius: 20px; padding: 28px; box-shadow: 0 20px 50px rgba(10,31,78,0.25);
    }
    .modal-icon-badge {
      width: 42px; height: 42px; border-radius: 10px;
      background: rgba(10, 31, 78, 0.08); display: flex;
      align-items: center; justify-content: center; font-size: 22px;
    }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid var(--border-light); }
    .modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted); }

    .report-body { flex: 1; overflow-y: auto; padding: 16px 4px 8px 0; }

    .juri-question-banner {
      background: linear-gradient(135deg, #0a1f4e 0%, #142a6e 100%);
      color: #ffffff; padding: 18px 22px; border-radius: 10px; margin-bottom: 20px;
    }
    .q-label { font-size: 9px; font-weight: 800; letter-spacing: 2px; color: #c8842a; text-transform: uppercase; }
    .q-text { font-size: 16px; font-weight: 700; margin: 6px 0 12px 0; line-height: 1.4; color: #ffffff; }
    .q-meta { display: flex; align-items: center; gap: 16px; font-size: 12px; color: rgba(255,255,255,0.85); flex-wrap: wrap; }
  `]
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
