import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface CollectionInfo {
  name: string;
  metadata: any;
  count: number;
}

export interface CollectionRecord {
  id: string;
  metadata: any;
  document: string;
  score?: number;
  distance?: number;
}

export interface MetadataPair {
  key: string;
  val: string;
}

export interface FilterItem {
  key: string;
  value: string;
}

@Component({
  selector: 'app-db-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="db-page animate-fadeIn">
  <!-- Page Header -->
  <div class="page-header animate-fadeInUp">
    <div>
      <h2>🗄️ Gestionnaire de Base de Données Vectorielle</h2>
      <p>Explorez les collections ChromaDB locales, effectuez des recherches sémantiques et filtrez par métadonnées complexes.</p>
    </div>
  </div>

  <div class="db-grid">
    <!-- Left Column: Collections List -->
    <div class="card collections-card animate-fadeInUp" style="animation-delay:.06s">
      <div class="card-header flex-between">
        <h3>Collections Actives</h3>
        <span class="badge badge-navy" *ngIf="collections().length">{{ collections().length }} collection(s)</span>
      </div>

      <div class="collection-list" *ngIf="collections().length > 0">
        <div class="collection-item"
             *ngFor="let col of collections()"
             [class.active]="selectedCollectionName() === col.name"
             (click)="selectCollection(col.name)">
          <div class="col-info">
            <span class="col-icon">📁</span>
            <div class="col-text-wrapper">
              <span class="col-name">{{ col.name }}</span>
              <span class="col-meta-tag">Distance: {{ col.metadata?.['hnsw:space'] || 'cosine' }}</span>
            </div>
          </div>
          <div class="col-badge-wrapper">
            <span class="badge badge-teal">{{ col.count }} vecteurs</span>
            <button class="delete-col-btn" (click)="deleteCollection($event, col.name)" title="Supprimer la collection">
              🗑️
            </button>
          </div>
        </div>
      </div>

      <div class="empty-state-small" *ngIf="collections().length === 0 && !loadingCollections()">
        <p>Aucune collection vectorielle trouvée dans ChromaDB.</p>
      </div>

      <div class="flex-center" style="margin-top: 16px;">
        <button class="btn btn-outline btn-sm btn-full" (click)="loadCollections()">
          🔄 Actualiser la liste
        </button>
      </div>
    </div>

    <!-- Right Column: Collection Records & Metadata Filters -->
    <div class="card records-card animate-fadeInUp" style="animation-delay:.12s">
      <div class="card-header flex-between" style="margin-bottom: 16px;">
        <h3>Contenu & Filtres par Métadonnées</h3>
        <span class="badge badge-navy" *ngIf="selectedCollectionName()">{{ selectedCollectionName() }}</span>
      </div>

      <div *ngIf="!selectedCollectionName()" class="no-selection-state">
        <div class="selection-icon">🗂️</div>
        <h4>Sélectionnez une collection</h4>
        <p>Choisissez une collection dans la liste à gauche pour appliquer des filtres par métadonnées et explorer ses vecteurs.</p>
      </div>

      <div *ngIf="selectedCollectionName()">
        <!-- Mode Tabs -->
        <div class="mode-tabs-bar">
          <button class="tab-btn" [class.active]="viewMode === 'SEARCH'" (click)="setMode('SEARCH')">
            🔍 Recherche Sémantique + Filtres
          </button>
          <button class="tab-btn" [class.active]="viewMode === 'PEEK'" (click)="setMode('PEEK')">
            📜 Inspection & Métadonnées (Peek)
          </button>
        </div>

        <!-- METADATA FILTER BUILDER ROW -->
        <div class="metadata-filter-box card-sub">
          <div class="filter-box-header flex-between">
            <span class="filter-box-title">🏷️ Filtres par Métadonnées (ChromaDB Where Clause)</span>
            <button class="btn-text-sm" (click)="addActiveFilter()" *ngIf="newFilterKey">
              + Appliquer le filtre
            </button>
          </div>

          <div class="filter-input-grid">
            <!-- Key Selector -->
            <div class="form-group">
              <label class="form-label-xs">Clé de métadonner</label>
              <select class="form-control form-control-sm" [(ngModel)]="newFilterKey" (ngModelChange)="onFilterKeyChange()">
                <option value="">Sélectionner une clé...</option>
                <option *ngFor="let k of availableMetadataKeys()" [value]="k">{{ k }}</option>
              </select>
            </div>

            <!-- Value Selector / Input -->
            <div class="form-group">
              <label class="form-label-xs">Valeur cible</label>
              <input class="form-control form-control-sm"
                     type="text"
                     [(ngModel)]="newFilterValue"
                     [attr.list]="'distinct-vals-' + newFilterKey"
                     placeholder="Valeur exacte (ex: BAM, Article 15)..."
                     (keyup.enter)="addActiveFilter()" />
              
              <datalist [id]="'distinct-vals-' + newFilterKey" *ngIf="newFilterKey && distinctValuesMap()[newFilterKey]">
                <option *ngFor="let val of distinctValuesMap()[newFilterKey]" [value]="val">{{ val }}</option>
              </datalist>
            </div>

            <button class="btn btn-secondary btn-sm filter-add-btn" (click)="addActiveFilter()" [disabled]="!newFilterKey || !newFilterValue">
              + Filtrer
            </button>
          </div>

          <!-- Active Filter Chips -->
          <div class="active-filter-chips" *ngIf="activeFilters.length > 0">
            <span class="filter-chip" *ngFor="let f of activeFilters; let idx = index">
              🏷️ <strong>{{ f.key }}:</strong> {{ f.value }}
              <button (click)="removeActiveFilter(idx)" class="chip-del">✕</button>
            </span>
            <button (click)="clearAllFilters()" class="btn-clear-all">Effacer les filtres</button>
          </div>
        </div>

        <!-- Semantic Search Input for SEARCH mode -->
        <div class="search-controls-box" *ngIf="viewMode === 'SEARCH'">
          <div class="vector-search-input-wrap">
            <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input class="form-control input-with-icon"
                   type="text"
                   [(ngModel)]="vectorQueryText"
                   placeholder="Saisissez une requête textuelle pour chercher par proximité vectorielle..."
                   (keyup.enter)="fetchRecords()" />
            <button class="btn btn-primary btn-sm" (click)="fetchRecords()" [disabled]="loadingRecords() || !vectorQueryText.trim()">
              <span class="spinner" *ngIf="loadingRecords()"></span>
              <span *ngIf="!loadingRecords()">Chercher</span>
            </button>
          </div>
        </div>

        <!-- Filter bar for PEEK mode text search -->
        <div class="records-filter-bar" *ngIf="viewMode === 'PEEK'">
          <input class="form-control" type="text" [(ngModel)]="searchTerm" placeholder="Filtrer localement les résultats par texte..." />
        </div>

        <!-- Alerts -->
        <div class="alert-success-sm" *ngIf="successMsg()">✅ {{ successMsg() }}</div>
        <div class="alert-error-sm" *ngIf="errorMsg()">⚠️ {{ errorMsg() }}</div>

        <!-- Loading spinner -->
        <div class="loading-state" *ngIf="loadingRecords()">
          <div class="spinner"></div>
          <span>Chargement des vecteurs...</span>
        </div>

        <!-- Records List -->
        <div class="records-scroll-container" *ngIf="!loadingRecords() && records().length > 0">
          <div class="record-item card-hover" *ngFor="let rec of filteredRecords()">
            <div class="record-top flex-between">
              <div class="record-left-meta">
                <span class="record-id">ID: <code>{{ rec.id }}</code></span>
                <span class="score-badge" *ngIf="rec.score !== undefined">
                  Score: {{ (rec.score * 100).toFixed(1) }}%
                </span>
              </div>
              <div class="record-actions">
                <button class="btn btn-ghost btn-sm btn-edit" (click)="openEditModal(rec)">
                  ✏️ Modifier
                </button>
                <button class="btn btn-ghost btn-sm btn-del" (click)="deleteRecord(rec.id)">
                  🗑️
                </button>
              </div>
            </div>

            <div class="record-body">
              <p class="record-doc">"{{ rec.document }}"</p>

              <!-- Metadata display -->
              <div class="meta-container">
                <span class="meta-title">MÉTADONNÉES :</span>
                <div class="meta-tags-grid">
                  <span class="meta-tag" *ngFor="let m of getMetadataPairs(rec.metadata)" [class.meta-matched]="isMetadataMatched(m.key)">
                    <strong>{{ m.key }}:</strong> {{ m.val }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="empty-state-small" *ngIf="filteredRecords().length === 0">
            <p>Aucun vecteur ne correspond à vos critères.</p>
          </div>
        </div>

        <div class="empty-state-small" *ngIf="!loadingRecords() && records().length === 0">
          <p>{{ viewMode === 'SEARCH' ? 'Saisissez une requête ci-dessus pour lancer la recherche.' : 'Aucun vecteur trouvé pour ces filtres.' }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- EDIT VECTOR & METADATA MODAL -->
  <div class="modal-overlay" *ngIf="showEditModal()" (click)="closeEditModal($event)">
    <div class="modal-box animate-fadeInUp">
      <div class="modal-header">
        <h3>✏️ Modifier le Vecteur & Métadonnées</h3>
        <button class="modal-close" (click)="closeEditModal()">✕</button>
      </div>

      <div class="modal-body" *ngIf="editingRecord">
        <div class="form-group">
          <label class="form-label">ID du Vecteur (ChromaDB)</label>
          <input class="form-control input-readonly" type="text" [value]="editingRecord.id" readonly />
        </div>

        <div class="form-group">
          <label class="form-label">Texte du document / Content Payload</label>
          <textarea class="form-control payload-textarea" rows="5" [(ngModel)]="editDocumentText" placeholder="Contenu textuel du vecteur..."></textarea>
          <span class="input-hint">Remarque : Modifier le texte recalculera automatiquement l'embedding sémantique (384-dim).</span>
        </div>

        <!-- Editable Metadata Pairs -->
        <div class="form-group">
          <div class="flex-between" style="margin-bottom: 8px;">
            <label class="form-label" style="margin:0">Métadonnées (Clé - Valeur)</label>
            <button class="btn btn-secondary btn-sm" (click)="addMetadataRow()">+ Ajouter une clé</button>
          </div>

          <div class="metadata-edit-list">
            <div class="metadata-edit-row" *ngFor="let row of editMetadataRows; let idx = index">
              <input class="form-control" type="text" [(ngModel)]="row.key" placeholder="Clé (ex: article)" />
              <input class="form-control" type="text" [(ngModel)]="row.val" placeholder="Valeur (ex: Article 15)" />
              <button class="btn-del-row" (click)="removeMetadataRow(idx)" title="Supprimer cette clé">✕</button>
            </div>
          </div>
        </div>

        <div class="alert-error-sm" *ngIf="editError()">{{ editError() }}</div>
      </div>

      <div class="modal-footer flex-end">
        <button class="btn btn-ghost" (click)="closeEditModal()">Annuler</button>
        <button class="btn btn-primary" (click)="saveRecordUpdate()" [disabled]="editSaving()">
          <span class="spinner" *ngIf="editSaving()"></span>
          <span *ngIf="!editSaving()">Enregistrer les modifications</span>
        </button>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .db-page { display: flex; flex-direction: column; gap: 24px; }
    .page-header h2 { font-size: 20px; color: var(--navy); margin-bottom: 4px; }
    .page-header p { font-size: 13px; color: var(--text-muted); }

    .db-grid { display: grid; grid-template-columns: 1fr 1.8fr; gap: 24px; align-items: start; }
    @media (max-width: 950px) { .db-grid { grid-template-columns: 1fr; } }

    .card-header h3 { font-size: 16px; color: var(--navy); }

    /* COLLECTIONS LIST */
    .collection-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .collection-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px; border: 1px solid var(--border); border-radius: var(--radius);
      cursor: pointer; transition: var(--transition); background: var(--bg-white);
    }
    .collection-item:hover { border-color: var(--primary); background: var(--bg); }
    .collection-item.active { border-color: var(--primary); background: rgba(0, 166, 147, 0.05); }

    .col-info { display: flex; align-items: center; gap: 10px; }
    .col-icon { font-size: 20px; }
    .col-text-wrapper { display: flex; flex-direction: column; }
    .col-name { font-weight: 600; color: var(--navy); font-size: 14px; }
    .col-meta-tag { font-size: 11px; color: var(--text-light); margin-top: 1px; }

    .col-badge-wrapper { display: flex; align-items: center; gap: 8px; }
    .delete-col-btn {
      background: none; border: none; cursor: pointer; font-size: 14px; padding: 4px;
      border-radius: 4px; transition: var(--transition);
    }
    .delete-col-btn:hover { background: rgba(239, 68, 68, 0.1); }

    /* MODE TABS */
    .mode-tabs-bar { display: flex; gap: 6px; background: var(--bg); padding: 4px; border-radius: 10px; margin-bottom: 14px; }
    .tab-btn {
      flex: 1; padding: 8px 12px; border: none; background: transparent; font-size: 12px;
      font-weight: 600; color: var(--text-muted); border-radius: 8px; cursor: pointer; transition: var(--transition);
    }
    .tab-btn.active { background: var(--bg-white); color: var(--navy); box-shadow: var(--shadow-sm); }

    /* METADATA FILTER BUILDER */
    .card-sub { background: #f8fafc; border: 1px solid var(--border-light); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
    .filter-box-header { margin-bottom: 10px; }
    .filter-box-title { font-size: 12px; font-weight: 700; color: var(--navy); }
    .btn-text-sm { background: none; border: none; font-size: 11px; color: var(--primary); font-weight: 600; cursor: pointer; }

    .filter-input-grid { display: flex; gap: 10px; align-items: flex-end; }
    .filter-input-grid .form-group { flex: 1; margin: 0; }
    .form-label-xs { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 3px; display: block; }
    .form-control-sm { padding: 8px 12px; font-size: 12px; }
    .filter-add-btn { height: 34px; white-space: nowrap; font-size: 12px; }

    .active-filter-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-light); }
    .filter-chip {
      background: rgba(10,31,78,.08); color: var(--navy); border: 1px solid rgba(10,31,78,.15);
      padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 500;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .chip-del { background: none; border: none; font-size: 12px; cursor: pointer; color: var(--text-muted); padding: 0; }
    .chip-del:hover { color: var(--danger); }
    .btn-clear-all { background: none; border: none; font-size: 11px; color: var(--danger); cursor: pointer; font-weight: 600; margin-left: 4px; }
    .btn-clear-all:hover { text-decoration: underline; }

    /* SEARCH CONTROLS */
    .search-controls-box { margin-bottom: 14px; }
    .vector-search-input-wrap { position: relative; display: flex; gap: 8px; align-items: center; }
    .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-light); pointer-events: none; }
    .input-with-icon { padding-left: 38px; flex: 1; }

    /* RECORDS VIEW */
    .no-selection-state { text-align: center; padding: 80px 32px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .selection-icon { font-size: 56px; }
    .no-selection-state h4 { color: var(--navy); }
    .no-selection-state p { color: var(--text-muted); font-size: 13px; }

    .records-filter-bar { margin-bottom: 14px; }
    .records-scroll-container { display: flex; flex-direction: column; gap: 14px; max-height: 540px; overflow-y: auto; padding-right: 4px; }

    .record-item { padding: 16px; border: 1px solid var(--border-light); border-radius: var(--radius); background: #ffffff; }
    .record-left-meta { display: flex; align-items: center; gap: 10px; }
    .record-id { font-size: 12px; color: var(--text-light); }
    .record-id code { background: var(--bg); padding: 2px 6px; border-radius: 4px; color: var(--navy); }

    .score-badge {
      background: rgba(0, 166, 147, 0.12); color: var(--primary-dark); font-size: 11px;
      font-weight: 700; padding: 2px 8px; border-radius: 999px;
    }

    .record-actions { display: flex; gap: 4px; }
    .btn-edit { color: var(--navy); }
    .btn-edit:hover { background: rgba(10,31,78,.08); }
    .btn-del { color: var(--danger); }
    .btn-del:hover { background: rgba(239,68,68,.08); }

    .record-doc { font-size: 13.5px; line-height: 1.6; color: var(--text); margin-top: 10px; font-style: italic; }

    /* METADATA VIEW */
    .meta-container { margin-top: 12px; border-top: 1px solid var(--border-light); padding-top: 10px; }
    .meta-title { font-size: 10px; font-weight: 700; color: var(--text-light); letter-spacing: 0.5px; display: block; margin-bottom: 6px; }
    .meta-tags-grid { display: flex; flex-wrap: wrap; gap: 6px; }
    .meta-tag { font-size: 11px; background: var(--bg); padding: 4px 8px; border-radius: 4px; color: var(--text-muted); border: 1px solid var(--border-light); }
    .meta-matched { background: rgba(0,166,147,.12); border-color: var(--primary); color: var(--primary-dark); font-weight: 600; }

    .empty-state-small { text-align: center; color: var(--text-light); padding: 30px; font-size: 13px; }
    .loading-state { padding: 40px; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 12px; }

    .alert-success-sm { background: rgba(16,185,129,.1); color: #059669; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }
    .alert-error-sm { background: rgba(239,68,68,.1); color: #dc2626; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }

    /* MODAL EDIT */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.5); backdrop-filter: blur(4px);
      z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .modal-box {
      background: #ffffff; border-radius: 16px; width: 100%; max-width: 600px;
      padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,.2); max-height: 90vh; display: flex; flex-direction: column;
    }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .modal-header h3 { font-size: 18px; color: var(--navy); margin: 0; }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-muted); }
    .modal-body { overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 16px; }
    .input-readonly { background: var(--bg); color: var(--text-muted); font-family: monospace; font-weight: 600; }
    .payload-textarea { font-size: 13.5px; line-height: 1.5; font-family: inherit; }
    .input-hint { font-size: 11px; color: var(--text-muted); font-style: italic; margin-top: 4px; display: block; }

    .metadata-edit-list { display: flex; flex-direction: column; gap: 8px; }
    .metadata-edit-row { display: grid; grid-template-columns: 1fr 1fr 32px; gap: 8px; align-items: center; }
    .btn-del-row { background: none; border: none; color: var(--danger); font-size: 16px; cursor: pointer; border-radius: 4px; padding: 4px; }
    .btn-del-row:hover { background: rgba(239,68,68,.1); }
    .modal-footer { display: flex; gap: 12px; margin-top: 20px; border-top: 1px solid var(--border-light); padding-top: 16px; }
    .flex-between { display: flex; align-items: center; justify-content: space-between; }
    .flex-end { justify-content: flex-end; }
  `]
})
export class DbManagerComponent implements OnInit {
  collections = signal<CollectionInfo[]>([]);
  records = signal<CollectionRecord[]>([]);

  selectedCollectionName = signal<string>('');
  viewMode: 'SEARCH' | 'PEEK' = 'PEEK';

  searchTerm = '';
  vectorQueryText = '';

  // Metadata keys & distinct values
  availableMetadataKeys = signal<string[]>([]);
  distinctValuesMap = signal<Record<string, string[]>>({});

  // Active Metadata Filters
  activeFilters: FilterItem[] = [];
  newFilterKey = '';
  newFilterValue = '';

  loadingCollections = signal(false);
  loadingRecords = signal(false);

  successMsg = signal('');
  errorMsg = signal('');

  // Edit Modal State
  showEditModal = signal(false);
  editingRecord: CollectionRecord | null = null;
  editDocumentText = '';
  editMetadataRows: MetadataPair[] = [];
  editSaving = signal(false);
  editError = signal('');

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadCollections();
  }

  loadCollections() {
    this.loadingCollections.set(true);
    this.http.get<any>(`${environment.apiUrl}/api/documents/db/collections`).subscribe({
      next: (res) => {
        this.collections.set(res.collections || []);
        this.loadingCollections.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loadingCollections.set(false);
      }
    });
  }

  selectCollection(name: string) {
    this.selectedCollectionName.set(name);
    this.activeFilters = [];
    this.newFilterKey = '';
    this.newFilterValue = '';

    this.loadMetadataKeys(name);
    this.fetchRecords();
  }

  loadMetadataKeys(name: string) {
    this.http.get<any>(`${environment.apiUrl}/api/documents/db/collections/${name}/metadata_keys`).subscribe({
      next: (res) => {
        this.availableMetadataKeys.set(res.metadata_keys || []);
        this.distinctValuesMap.set(res.distinct_values || {});
      },
      error: (err) => console.error(err)
    });
  }

  setMode(mode: 'SEARCH' | 'PEEK') {
    this.viewMode = mode;
    this.fetchRecords();
  }

  onFilterKeyChange() {
    this.newFilterValue = '';
  }

  addActiveFilter() {
    if (!this.newFilterKey || !this.newFilterValue.trim()) return;
    this.activeFilters.push({
      key: this.newFilterKey,
      value: this.newFilterValue.trim()
    });
    this.newFilterKey = '';
    this.newFilterValue = '';
    this.fetchRecords();
  }

  removeActiveFilter(idx: number) {
    this.activeFilters.splice(idx, 1);
    this.fetchRecords();
  }

  clearAllFilters() {
    this.activeFilters = [];
    this.fetchRecords();
  }

  fetchRecords() {
    const name = this.selectedCollectionName();
    if (!name) return;

    this.loadingRecords.set(true);

    if (this.viewMode === 'SEARCH') {
      if (!this.vectorQueryText.trim()) {
        this.records.set([]);
        this.loadingRecords.set(false);
        return;
      }

      const payload = {
        query: this.vectorQueryText.trim(),
        limit: 30,
        filters: this.activeFilters
      };

      this.http.post<any>(`${environment.apiUrl}/api/documents/db/collections/${name}/query`, payload).subscribe({
        next: (res) => {
          this.records.set(res.records || []);
          this.loadingRecords.set(false);
        },
        error: (err) => {
          console.error(err);
          this.loadingRecords.set(false);
        }
      });
    } else {
      // PEEK mode with optional metadata filters
      const payload = {
        limit: 100,
        filters: this.activeFilters
      };

      this.http.post<any>(`${environment.apiUrl}/api/documents/db/collections/${name}/peek`, payload).subscribe({
        next: (res) => {
          this.records.set(res.records || []);
          this.loadingRecords.set(false);
        },
        error: (err) => {
          console.error(err);
          this.loadingRecords.set(false);
        }
      });
    }
  }

  // EDIT MODAL METHODS
  openEditModal(rec: CollectionRecord) {
    this.editingRecord = rec;
    this.editDocumentText = rec.document || '';
    this.editMetadataRows = this.getMetadataPairs(rec.metadata);
    this.editError.set('');
    this.showEditModal.set(true);
  }

  closeEditModal(event?: MouseEvent) {
    if (event && !(event.target as HTMLElement).classList.contains('modal-overlay')) return;
    this.showEditModal.set(false);
    this.editingRecord = null;
  }

  addMetadataRow() {
    this.editMetadataRows.push({ key: '', val: '' });
  }

  removeMetadataRow(idx: number) {
    this.editMetadataRows.splice(idx, 1);
  }

  saveRecordUpdate() {
    if (!this.editingRecord) return;
    const colName = this.selectedCollectionName();
    if (!colName) return;

    const newMetadataDict: Record<string, string> = {};
    for (const pair of this.editMetadataRows) {
      if (pair.key.trim()) {
        newMetadataDict[pair.key.trim()] = pair.val;
      }
    }

    const payload = {
      document: this.editDocumentText,
      metadata: newMetadataDict
    };

    this.editSaving.set(true);
    this.editError.set('');

    const url = `${environment.apiUrl}/api/documents/db/collections/${colName}/records/${this.editingRecord.id}`;

    this.http.put<any>(url, payload).subscribe({
      next: (res) => {
        this.editSaving.set(false);
        this.showEditModal.set(false);
        this.successMsg.set(res.message || 'Vecteur mis à jour avec succès !');
        setTimeout(() => this.successMsg.set(''), 4000);

        this.fetchRecords();
        this.loadMetadataKeys(colName);
      },
      error: (err) => {
        this.editSaving.set(false);
        this.editError.set(err.error?.msg ?? err.error?.error ?? 'Erreur lors de la mise à jour du vecteur.');
      }
    });
  }

  deleteCollection(event: Event, name: string) {
    event.stopPropagation();
    if (!confirm(`Êtes-vous sûr de vouloir supprimer COMPLÈTEMENT la collection vectorielle "${name}" ?`)) return;

    this.http.delete(`${environment.apiUrl}/api/documents/db/collections/${name}`).subscribe({
      next: () => {
        if (this.selectedCollectionName() === name) {
          this.selectedCollectionName.set('');
          this.records.set([]);
        }
        this.loadCollections();
      },
      error: (err) => console.error(err)
    });
  }

  deleteRecord(id: string) {
    const colName = this.selectedCollectionName();
    if (!colName) return;
    if (!confirm('Supprimer ce vecteur ?')) return;

    this.http.delete(`${environment.apiUrl}/api/documents/db/collections/${colName}/records/${id}`).subscribe({
      next: () => {
        this.fetchRecords();
        this.loadCollections();
      },
      error: (err) => console.error(err)
    });
  }

  filteredRecords() {
    if (this.viewMode === 'SEARCH' || !this.searchTerm.trim()) return this.records();
    return this.records().filter(r => {
      const docMatch = r.document.toLowerCase().includes(this.searchTerm.toLowerCase());
      const idMatch = r.id.toLowerCase().includes(this.searchTerm.toLowerCase());
      return docMatch || idMatch;
    });
  }

  getMetadataPairs(meta: any): MetadataPair[] {
    if (!meta) return [];
    return Object.keys(meta).map(k => ({ key: k, val: String(meta[k] ?? '') }));
  }

  isMetadataMatched(key: string): boolean {
    return this.activeFilters.some(f => f.key.toLowerCase() === key.toLowerCase());
  }
}
