import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';

interface UploadedDocument {
  id: number;
  uuid: string;
  name: string;
  type: string;
  langue: string;
  date: string;
  status: string;
  ishidden: boolean;
  grouping?: string;
  collection_name?: string;
}

interface VectorCollection {
  id?: number;
  name: string;
  embedding_model: string;
  description?: string;
}

interface TitleLevelMapping {
  level: number;
  name: string;
  column: string;
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="docs-page">
  <div class="page-header animate-fadeInUp">
    <div>
      <h2>📁 Gestion des documents & Indexation</h2>
      <p>Indexez vos textes légaux (fichiers CSV) directement dans la base de données vectorielle ChromaDB.</p>
    </div>
  </div>

  <div class="docs-grid">
    <!-- Left Column: Upload Form -->
    <div class="card upload-card animate-fadeInUp" style="animation-delay:.06s">
      <div class="card-header">
        <h3>Indexation Vectorielle</h3>
      </div>

      <!-- Status messages -->
      <div class="alert-success" *ngIf="successMsg()">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
        <span>{{ successMsg() }}</span>
      </div>

      <div class="alert-error" *ngIf="errorMsg()">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        <span>{{ errorMsg() }}</span>
      </div>

      <!-- Upload Progress Section -->
      <div class="progress-panel glass animate-fadeInUp" *ngIf="loading()">
        <div class="progress-info flex-between">
          <span class="progress-status-lbl">
            <span class="spinner-sm" *ngIf="uploadPhase() === 'indexing'"></span>
            {{ getPhaseLabel() }}
          </span>
          <span class="progress-percent" *ngIf="uploadPhase() === 'uploading'">{{ progress() }}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill"
               [class.progress-bar-striped]="uploadPhase() === 'indexing'"
               [style.width.%]="uploadPhase() === 'indexing' ? 100 : progress()"></div>
        </div>
      </div>

      <form (ngSubmit)="onUploadSubmit()" class="upload-form" *ngIf="!loading()">
        <!-- Collection selection -->
        <div class="form-group">
          <label class="form-label">Collection Cible (depuis la base SQL)</label>
          <select class="form-control" [(ngModel)]="uploadParams.collection_name" name="collection_name">
            <option *ngFor="let col of vectorCollections()" [value]="col.name">
              {{ col.name }} (Modèle: {{ col.embedding_model.split('/').pop() }})
            </option>
            <option value="custom">+ Créer une nouvelle collection...</option>
          </select>
        </div>

        <!-- Custom collection fields -->
        <ng-container *ngIf="uploadParams.collection_name === 'custom'">
          <div class="custom-coll-panel glass animate-fadeInUp">
            <div class="form-group">
              <label class="form-label text-teal">Nom de la nouvelle collection</label>
              <input class="form-control" type="text" [(ngModel)]="newColForm.name" name="new_col_name" placeholder="Ex: circulaire-bam-2026" />
            </div>

            <div class="form-group">
              <label class="form-label text-teal">Modèle d'embedding</label>
              <select class="form-control" [(ngModel)]="newColForm.embedding_model" name="new_col_model">
                <option value="google/embeddinggemma-300m">Gemma 300M (google/embeddinggemma-300m)</option>
                <option value="sentence-transformers/all-MiniLM-L6-v2">MiniLM L6 (sentence-transformers/all-MiniLM-L6-v2)</option>
                <option value="custom_model">Autre modèle (saisir le chemin)...</option>
              </select>
            </div>

            <div class="form-group animate-fadeInUp" *ngIf="newColForm.embedding_model === 'custom_model'">
              <label class="form-label text-teal">Chemin / Nom du modèle HuggingFace</label>
              <input class="form-control" type="text" [(ngModel)]="customModelPath" name="custom_model_path" placeholder="Ex: intfloat/multilingual-e5-large" />
            </div>

            <div class="form-group">
              <label class="form-label text-teal">Description</label>
              <input class="form-control" type="text" [(ngModel)]="newColForm.description" name="new_col_desc" placeholder="Description de la collection..." />
            </div>
          </div>
        </ng-container>

        <!-- Group Name -->
        <div class="form-group">
          <label class="form-label">Groupe de document (grouping)</label>
          <input class="form-control" type="text" [(ngModel)]="uploadParams.group_value" name="group_value" placeholder="Ex: Circulaire BAM 2026, Code de Commerce" />
          <span class="field-hint">Sert à grouper les résultats de recherche sémantique au niveau du document.</span>
        </div>

        <!-- File Selector -->
        <div class="form-group">
          <label class="form-label">Fichier CSV</label>
          <div class="file-dropzone" [class.file-selected]="selectedFile">
            <input type="file" (change)="onFileSelected($event)" accept=".csv" class="file-input-hidden" id="csvFileInput" />
            <label for="csvFileInput" class="dropzone-label">
              <span class="dropzone-icon">📥</span>
              <span class="dropzone-text" *ngIf="!selectedFile">Glissez votre fichier CSV ici ou cliquez pour parcourir</span>
              <span class="dropzone-text-selected" *ngIf="selectedFile">{{ selectedFile.name }} ({{ formatSize(selectedFile.size) }})</span>
            </label>
          </div>
        </div>

        <button class="btn btn-primary btn-full" type="submit" [disabled]="loading() || !selectedFile">
          <span>
            Configurer & Indexer
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </span>
        </button>
      </form>
    </div>

    <!-- Right Column: Document History with Pagination, Collection & Grouping Filters -->
    <div class="card list-card animate-fadeInUp" style="animation-delay:.12s; padding:0; overflow:hidden">
      <div class="card-header-with-filters">
        <div class="flex-between">
          <h3>Historique des documents indexés</h3>
          <span class="badge badge-navy">{{ totalItems() }} document(s)</span>
        </div>

        <!-- FILTER BAR -->
        <div class="doc-filter-row">
          <!-- Search Input -->
          <div class="input-wrapper search-wrapper">
            <svg class="search-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input class="form-control form-control-sm input-with-icon"
                   type="text"
                   [(ngModel)]="searchTerm"
                   (ngModelChange)="onFilterChange()"
                   placeholder="Chercher par nom..." />
          </div>

          <!-- Collection Filter Dropdown -->
          <div class="grouping-filter-wrapper">
            <select class="form-control form-control-sm" [(ngModel)]="selectedCollectionFilter" (ngModelChange)="onFilterChange()">
              <option value="">Toutes les collections</option>
              <option *ngFor="let col of vectorCollections()" [value]="col.name">{{ col.name }}</option>
            </select>
          </div>

          <!-- Grouping Filter Dropdown -->
          <div class="grouping-filter-wrapper">
            <select class="form-control form-control-sm" [(ngModel)]="selectedGroupingFilter" (ngModelChange)="onFilterChange()">
              <option value="">Tous les groupes</option>
              <option *ngFor="let g of availableGroupings()" [value]="g">{{ g }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- TABLE -->
      <table class="doc-table">
        <thead>
          <tr>
            <th>Nom du document</th>
            <th>Collection</th>
            <th>Groupe (Grouping)</th>
            <th>Date</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let doc of documents()">
            <td>
              <div class="doc-title-cell">
                <span class="doc-icon">📄</span>
                <span class="doc-name">{{ doc.name }}</span>
              </div>
            </td>
            <td>
              <span class="badge badge-navy" *ngIf="doc.collection_name">📁 {{ doc.collection_name }}</span>
              <span class="text-muted" *ngIf="!doc.collection_name">—</span>
            </td>
            <td>
              <span class="badge badge-teal" *ngIf="doc.grouping">📂 {{ doc.grouping }}</span>
              <span class="text-muted" *ngIf="!doc.grouping">—</span>
            </td>
            <td class="text-muted">{{ doc.date | date:'dd/MM/yyyy' }}</td>
            <td>
              <span class="badge" [class]="doc.ishidden ? 'badge-danger' : 'badge-success'">
                {{ doc.ishidden ? 'Invisible' : 'Actif' }}
              </span>
            </td>
            <td>
              <div style="display:flex; gap:4px">
                <button class="btn btn-ghost btn-sm" (click)="openRenameModal(doc)" style="color:var(--primary)" title="Renommer le document dans SQL et ChromaDB">
                  ✏️
                </button>
                <button class="btn btn-ghost btn-sm" (click)="deleteDoc(doc.id)" style="color:var(--danger)" title="Masquer / Supprimer">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
          <tr *ngIf="documents().length === 0">
            <td colspan="6" class="empty-row">Aucun document indexé correspondant.</td>
          </tr>
        </tbody>
      </table>

      <!-- PAGINATION FOOTER -->
      <div class="pagination-footer flex-between" *ngIf="totalItems() > 0">
        <div class="per-page-selector">
          <label>Afficher par page :</label>
          <select class="form-control form-control-xs" [(ngModel)]="pageSize" (ngModelChange)="onFilterChange()">
            <option [ngValue]="5">5</option>
            <option [ngValue]="10">10</option>
            <option [ngValue]="20">20</option>
            <option [ngValue]="50">50</option>
          </select>
        </div>

        <div class="pagination-info">
          Page <strong>{{ currentPage() }}</strong> sur <strong>{{ totalPages() }}</strong> ({{ totalItems() }} docs)
        </div>

        <div class="pagination-buttons">
          <button class="btn btn-outline btn-xs" [disabled]="currentPage() <= 1" (click)="goToPage(currentPage() - 1)">
            ◄ Précédent
          </button>
          <button class="btn btn-outline btn-xs" [disabled]="currentPage() >= totalPages()" (click)="goToPage(currentPage() + 1)">
            Suivant ►
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- CSV COLUMNS MAPPING MODAL -->
  <div class="modal-overlay" *ngIf="showMappingModal()" (click)="showMappingModal.set(false)">
    <div class="modal-box animate-fadeInUp" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>🛠️ Mappage des Colonnes du Fichier CSV</h3>
        <button class="modal-close" (click)="showMappingModal.set(false)">✕</button>
      </div>

      <div class="modal-body-content">
        <p class="modal-desc">
          Mappez les colonnes de votre fichier CSV vers le gabarit système (Contenu à vectoriser, Document, Pages, URL, et les 6 niveaux de titres optionnels).
        </p>

        <!-- Content columns check list -->
        <div class="mapping-section">
          <label class="form-label block-label">Vecteur (Sélectionner les colonnes de contenu à combiner)</label>
          <div class="checkbox-grid">
            <label class="checkbox-item" *ngFor="let col of csvColumns()">
              <input type="checkbox" [checked]="selectedContentCols.has(col)" (change)="toggleContentCol(col)" />
              <span>{{ col }}</span>
            </label>
          </div>
          <span class="field-hint">Ces colonnes seront fusionnées pour générer le vecteur d'embedding sémantique.</span>
        </div>

        <!-- Document and Base metadata -->
        <div class="mapping-section">
          <div class="row-fields">
            <div class="form-group">
              <label class="form-label">Colonne Document (Nom / Réf)</label>
              <select class="form-control" [(ngModel)]="metadataMappings.document_column">
                <option value="">-- Par défaut (Nom du fichier) --</option>
                <option *ngFor="let col of csvColumns()" [value]="col">{{ col }}</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Colonne URL du document</label>
              <select class="form-control" [(ngModel)]="metadataMappings.document_url_column">
                <option value="">-- Aucun --</option>
                <option *ngFor="let col of csvColumns()" [value]="col">{{ col }}</option>
              </select>
            </div>

            <div class="form-group" style="grid-column: 1 / -1">
              <label class="form-label">Colonne Pages</label>
              <select class="form-control" [(ngModel)]="metadataMappings.pages_column">
                <option value="">-- Aucun --</option>
                <option *ngFor="let col of csvColumns()" [value]="col">{{ col }}</option>
              </select>
            </div>
          </div>

          <!-- Displayed content column -->
          <div class="form-group" style="margin-top:12px">
            <label class="form-label block-label">Contenu affiché dans les résultats de recherche</label>
            <select class="form-control" [(ngModel)]="metadataMappings.display_content_column">
              <option value="">-- Même que le texte vectorisé --</option>
              <option *ngFor="let col of csvColumns()" [value]="col">{{ col }}</option>
            </select>
            <span class="field-hint">La colonne sélectionnée ici sera montrée à l'utilisateur dans les résultats de recherche. Si vide, le texte vectorisé sera affiché.</span>
          </div>
        </div>

        <!-- 6 levels of Titles -->
        <div class="mapping-section">
          <label class="form-label block-label">Niveaux de Titres Hiérarchiques (Optionnels)</label>
          <div class="title-levels-container">
            <div class="title-level-row" *ngFor="let lvl of titleLevels; let idx = index">
              <span class="level-num-lbl">Niv. {{ lvl.level }}</span>
              <input class="form-control level-name-input" type="text" [(ngModel)]="lvl.name" placeholder="Nom (ex: Chapitre)" />
              <select class="form-control level-col-select" [(ngModel)]="lvl.column">
                <option value="">-- Ignorer ce niveau --</option>
                <option *ngFor="let col of csvColumns()" [value]="col">{{ col }}</option>
              </select>
            </div>
          </div>
          <span class="field-hint">Ces champs structurent l'arborescence du document pour le regroupement et le tri des résultats.</span>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" (click)="showMappingModal.set(false)">Annuler</button>
        <button class="btn btn-primary" (click)="confirmAndUpload()" [disabled]="selectedContentCols.size === 0">
          Valider et Indexer
        </button>
      </div>
    </div>
  </div>

  <!-- RENAME DOCUMENT MODAL -->
  <div class="modal-overlay" *ngIf="showRenameModal()" (click)="showRenameModal.set(false)">
    <div class="modal-box animate-fadeInUp" (click)="$event.stopPropagation()" style="max-width: 460px">
      <div class="modal-header">
        <h3>✏️ Renommer le document</h3>
        <button class="modal-close" (click)="showRenameModal.set(false)">✕</button>
      </div>

      <div class="modal-body-content">
        <p class="modal-desc">
          Le nouveau nom sera immédiatement appliqué dans la base de données <strong>SQL</strong> ainsi que dans tous les vecteurs correspondants de la collection <strong>ChromaDB</strong>.
        </p>

        <div class="form-group">
          <label class="form-label">Nom actuel :</label>
          <input class="form-control" type="text" [value]="renamingDoc()?.name" disabled style="background:#f1f5f9; color:#64748b" />
        </div>

        <div class="form-group" style="margin-top:14px">
          <label class="form-label text-teal">Nouveau nom du document :</label>
          <input class="form-control" type="text" [(ngModel)]="newDocName" placeholder="Entrez le nouveau nom..." (keyup.enter)="confirmRename()" />
        </div>
      </div>

      <div class="modal-actions" style="margin-top:20px">
        <button class="btn btn-ghost" (click)="showRenameModal.set(false)">Annuler</button>
        <button class="btn btn-primary" (click)="confirmRename()" [disabled]="renameLoading() || !newDocName.trim() || newDocName.trim() === renamingDoc()?.name">
          <span *ngIf="!renameLoading()">Renommer & Synchroniser ChromaDB</span>
          <span *ngIf="renameLoading()">Synchronisation ChromaDB...</span>
        </button>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .docs-page { display: flex; flex-direction: column; gap: 24px; }
    .page-header h2 { font-size: 20px; color: var(--navy); margin-bottom: 4px; }
    .page-header p { font-size: 13px; color: var(--text-muted); }

    .docs-grid { display: grid; grid-template-columns: 1fr 1.35fr; gap: 24px; align-items: start; }
    @media (max-width: 950px) { .docs-grid { grid-template-columns: 1fr; } }

    .card-header h3 { font-size: 16px; color: var(--navy); margin-bottom: 12px; }

    .card-header-with-filters { padding: 20px 24px 14px 24px; border-bottom: 1px solid var(--border-light); background: #ffffff; }
    .card-header-with-filters h3 { font-size: 16px; color: var(--navy); margin: 0; }

    .doc-filter-row { display: flex; gap: 10px; align-items: center; margin-top: 14px; flex-wrap: wrap; }
    .search-wrapper { flex: 1.2; position: relative; min-width: 140px; }
    .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-light); pointer-events: none; }
    .input-with-icon { padding-left: 32px; }
    .grouping-filter-wrapper { flex: 1; min-width: 130px; }
    .form-control-sm { padding: 6px 12px; font-size: 12px; }
    .form-control-xs { padding: 4px 8px; font-size: 11px; height: 28px; width: 64px; }

    .upload-form { display: flex; flex-direction: column; gap: 18px; margin-top: 10px; }
    .field-hint { font-size: 11px; color: var(--text-muted); margin-top: 3px; display: block; }

    .custom-coll-panel {
      border: 1px solid rgba(0, 166, 147, 0.2); border-radius: var(--radius);
      padding: 16px; display: flex; flex-direction: column; gap: 12px;
      background: rgba(0, 166, 147, 0.02);
    }

    /* DROPZONE */
    .file-dropzone {
      border: 2px dashed var(--border); border-radius: var(--radius);
      padding: 24px 16px; text-align: center; background: var(--bg);
      transition: var(--transition); cursor: pointer; position: relative;
    }
    .file-dropzone:hover { border-color: var(--primary); background: rgba(0, 166, 147, 0.04); }
    .file-selected { border-style: solid; border-color: var(--primary); background: rgba(0, 166, 147, 0.06); }
    .file-input-hidden { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
    .dropzone-label { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; }
    .dropzone-icon { font-size: 32px; }
    .dropzone-text { font-size: 13px; color: var(--text-muted); }
    .dropzone-text-selected { font-size: 13px; font-weight: 600; color: var(--primary-dark); }

    /* TABLE */
    .doc-table { width: 100%; border-collapse: collapse; }
    .doc-table th { background: var(--bg); padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid var(--border); }
    .doc-table td { padding: 12px 14px; border-bottom: 1px solid var(--border-light); font-size: 13px; }
    .doc-table tr:last-child td { border-bottom: none; }
    .doc-table tr:hover td { background: var(--bg); }
    .doc-title-cell { display: flex; align-items: center; gap: 8px; }
    .doc-name { font-weight: 500; color: var(--navy); word-break: break-all; }
    .empty-row { text-align: center; color: var(--text-light); padding: 40px; }

    /* PAGINATION FOOTER */
    .pagination-footer { padding: 12px 20px; border-top: 1px solid var(--border-light); background: var(--bg); font-size: 12px; color: var(--text-muted); }
    .per-page-selector { display: flex; align-items: center; gap: 8px; }
    .pagination-buttons { display: flex; gap: 6px; }
    .btn-xs { padding: 4px 10px; font-size: 11px; border-radius: 6px; }

    /* ALERTS */
    .alert-success {
      display: flex; align-items: center; gap: 8px;
      background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2);
      color: #065f46; padding: 12px 16px; border-radius: 10px; font-size: 13px; margin-bottom: 14px;
    }
    .alert-error {
      display: flex; align-items: center; gap: 8px;
      background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2);
      color: #991b1b; padding: 12px 16px; border-radius: 10px; font-size: 13px; margin-bottom: 14px;
    }

    /* PROGRESS BAR */
    .progress-panel { padding: 20px; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 18px; background: rgba(0, 166, 147, 0.02); }
    .progress-info { margin-bottom: 8px; font-size: 13px; }
    .progress-status-lbl { font-weight: 600; color: var(--navy); display: flex; align-items: center; gap: 6px; }
    .progress-percent { font-weight: 700; color: var(--primary); }
    .progress-bar-bg { width: 100%; height: 8px; background: var(--border-light); border-radius: 99px; overflow: hidden; }
    .progress-bar-fill { height: 100%; background: var(--primary-grad); transition: width 0.2s ease-out; border-radius: 99px; }

    .spinner-sm {
      width: 14px; height: 14px; border: 2px solid var(--primary-light);
      border-top-color: transparent; border-radius: 50%; display: inline-block;
      animation: spin 0.8s linear infinite;
    }

    .progress-bar-striped {
      background-image: linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.15) 25%,
        transparent 25%,
        transparent 50%,
        rgba(255, 255, 255, 0.15) 50%,
        rgba(255, 255, 255, 0.15) 75%,
        transparent 75%,
        transparent
      );
      background-size: 1rem 1rem;
      animation: progress-bar-stripes 1s linear infinite;
    }

    @keyframes progress-bar-stripes {
      0% { background-position-x: 1rem; }
    }

    /* MODAL */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .modal-box { background: #fff; border-radius: 20px; padding: 32px; width: 100%; max-width: 620px; box-shadow: var(--shadow-lg); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .modal-header h3 { font-size: 18px; color: var(--navy); }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-muted); }
    .modal-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; line-height: 1.5; }
    .modal-body-content { max-height: 400px; overflow-y: auto; padding-right: 4px; }

    .mapping-section { margin-bottom: 24px; }
    .block-label { margin-bottom: 10px; font-weight: 700; }

    .checkbox-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px;
      padding: 12px; border: 1px solid var(--border); border-radius: var(--radius);
      background: var(--bg); max-height: 120px; overflow-y: auto;
    }
    .checkbox-item { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; color: var(--text); }
    .checkbox-item input { width: 15px; height: 15px; }

    .row-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
    .modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; }

    .title-levels-container {
      display: flex; flex-direction: column; gap: 8px;
      border: 1px solid var(--border); border-radius: var(--radius);
      padding: 12px; background: var(--bg);
    }
    .title-level-row { display: flex; align-items: center; gap: 10px; }
    .level-num-lbl { width: 48px; font-size: 12px; font-weight: 700; color: var(--text-muted); }
    .level-name-input { flex: 1; min-width: 100px; padding: 8px 12px; font-size: 13px; }
    .level-col-select { flex: 1.2; min-width: 130px; padding: 8px 12px; font-size: 13px; }
  `]
})
export class DocumentsComponent implements OnInit {
  documents = signal<UploadedDocument[]>([]);
  vectorCollections = signal<VectorCollection[]>([]);
  availableGroupings = signal<string[]>([]);

  // Filtering & Pagination State
  searchTerm = '';
  selectedCollectionFilter = '';
  selectedGroupingFilter = '';
  currentPage = signal(1);
  pageSize = 10;
  totalItems = signal(0);
  totalPages = signal(1);

  loading = signal(false);
  successMsg = signal('');
  errorMsg = signal('');
  selectedFile: File | null = null;
  customModelPath = '';

  // Progress tracking
  progress = signal<number>(0);
  uploadPhase = signal<string>('idle');

  // Columns Configuration
  showMappingModal = signal(false);
  csvColumns = signal<string[]>([]);
  selectedContentCols = new Set<string>();

  // Rename modal state
  showRenameModal = signal(false);
  renamingDoc = signal<UploadedDocument | null>(null);
  newDocName = '';
  renameLoading = signal(false);

  metadataMappings = {
    document_column: '',
    document_url_column: '',
    pages_column: '',
    display_content_column: ''
  };

  titleLevels: TitleLevelMapping[] = [
    { level: 1, name: 'Partie', column: '' },
    { level: 2, name: 'Livre', column: '' },
    { level: 3, name: 'Titre', column: '' },
    { level: 4, name: 'Sous-Titre', column: '' },
    { level: 5, name: 'Document', column: '' },
    { level: 6, name: 'Article', column: '' }
  ];

  uploadParams = {
    collection_name: 'loi-maroc-2025',
    group_value: ''
  };

  newColForm = {
    name: '',
    embedding_model: 'google/embeddinggemma-300m',
    description: ''
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadDocuments();
    this.loadVectorCollections();
    this.loadGroupings();
  }

  loadDocuments() {
    const params: any = {
      page: this.currentPage(),
      per_page: this.pageSize
    };
    if (this.selectedCollectionFilter) {
      params.collection_name = this.selectedCollectionFilter;
    }
    if (this.selectedGroupingFilter) {
      params.grouping = this.selectedGroupingFilter;
    }
    if (this.searchTerm.trim()) {
      params.name = this.searchTerm.trim();
    }

    this.http.get<any>('http://127.0.0.1:5000/api/documents/documents', { params }).subscribe({
      next: (res) => {
        this.documents.set(res.documents || []);
        this.totalItems.set(res.total_items ?? (res.documents || []).length);
        this.totalPages.set(res.total_pages ?? 1);
      },
      error: (err) => console.error(err)
    });
  }

  loadGroupings() {
    this.http.get<any>('http://127.0.0.1:5000/api/documents/documents/groupings').subscribe({
      next: (res) => {
        this.availableGroupings.set(res.groupings || []);
      },
      error: (err) => console.error(err)
    });
  }

  onFilterChange() {
    this.currentPage.set(1);
    this.loadDocuments();
  }

  goToPage(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
    this.loadDocuments();
  }

  loadVectorCollections() {
    this.http.get<any>('http://127.0.0.1:5000/api/documents/vector-collections').subscribe({
      next: (res) => {
        const cols = res.collections || [];
        this.vectorCollections.set(cols);

        if (cols.length > 0 && !this.uploadParams.collection_name) {
          this.uploadParams.collection_name = cols[0].name;
        }
      },
      error: (err) => console.error(err)
    });
  }

  onFileSelected(event: any) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.successMsg.set('');
      this.errorMsg.set('');
      this.progress.set(0);
      this.uploadPhase.set('idle');

      this.parseCSVHeaders(this.selectedFile);
    }
  }

  parseCSVHeaders(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      let text = e.target?.result as string;
      if (!text) return;
      let firstLine = text.split('\n')[0].replace(/\r/g, '');
      if (firstLine.charCodeAt(0) === 0xFEFF) {
        firstLine = firstLine.substring(1);
      }
      if (!firstLine) return;

      const delimiter = firstLine.includes(';') ? ';' : (firstLine.includes('\t') ? '\t' : ',');
      const cols = firstLine.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '').toLowerCase());

      this.csvColumns.set(cols);
      this.selectedContentCols.clear();

      if (cols.includes('contenu')) this.selectedContentCols.add('contenu');
      else if (cols.includes('paragraph')) this.selectedContentCols.add('paragraph');
      else if (cols.includes('content')) this.selectedContentCols.add('content');

      this.metadataMappings.document_column = cols.find(c => c === 'reference' || c === 'doc' || c === 'document') || '';
      this.metadataMappings.document_url_column = cols.find(c => c === 'hyperlink' || c === 'url' || c === 'document_url') || '';
      this.metadataMappings.pages_column = cols.find(c => c === 'pages' || c === 'page') || '';

      this.mapLevelIfExist(1, 'partie', cols);
      this.mapLevelIfExist(2, 'livre', cols);
      this.mapLevelIfExist(3, 'titre', cols);
      this.mapLevelIfExist(4, 'sous-titre', cols);
      this.mapLevelIfExist(5, 'document', cols);
      this.mapLevelIfExist(6, 'article', cols);
    };
    reader.readAsText(file);
  }

  private mapLevelIfExist(level: number, defaultName: string, cols: string[]) {
    const lvl = this.titleLevels.find(l => l.level === level);
    if (!lvl) return;
    lvl.column = '';
    const matchedCol = cols.find(c => c.includes(defaultName) || c === defaultName);
    if (matchedCol) {
      lvl.column = matchedCol;
    }
  }

  toggleContentCol(col: string) {
    if (this.selectedContentCols.has(col)) {
      this.selectedContentCols.delete(col);
    } else {
      this.selectedContentCols.add(col);
    }
  }

  onUploadSubmit() {
    if (!this.selectedFile) return;
    this.showMappingModal.set(true);
  }

  confirmAndUpload() {
    this.showMappingModal.set(false);
    this.loading.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');
    this.progress.set(0);
    this.uploadPhase.set('uploading');

    if (this.uploadParams.collection_name === 'custom') {
      const colName = this.newColForm.name.trim();
      const modelVal = this.newColForm.embedding_model === 'custom_model'
        ? this.customModelPath.trim()
        : this.newColForm.embedding_model;

      if (!colName) {
        this.errorMsg.set('Veuillez spécifier le nom de la nouvelle collection.');
        this.loading.set(false);
        this.uploadPhase.set('idle');
        return;
      }
      if (!modelVal) {
        this.errorMsg.set('Veuillez spécifier le modèle d\'embedding.');
        this.loading.set(false);
        this.uploadPhase.set('idle');
        return;
      }

      const createPayload = {
        name: colName,
        embedding_model: modelVal,
        description: this.newColForm.description.trim()
      };

      this.http.post<any>('http://127.0.0.1:5000/api/documents/vector-collections', createPayload)
        .subscribe({
          next: () => {
            this.uploadFile(colName);
          },
          error: (err) => {
            this.loading.set(false);
            this.uploadPhase.set('idle');
            this.errorMsg.set(err.error?.error || "Une erreur est survenue lors de la création de la collection.");
          }
        });
    } else {
      this.uploadFile(this.uploadParams.collection_name);
    }
  }

  uploadFile(collectionName: string) {
    if (!this.selectedFile) return;

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('collection_name', collectionName);
    formData.append('group_value', this.uploadParams.group_value.trim());

    const contentColsArray = Array.from(this.selectedContentCols);
    formData.append('content_columns', contentColsArray.join(','));

    formData.append('document_column', this.metadataMappings.document_column);
    formData.append('document_url_column', this.metadataMappings.document_url_column);
    formData.append('pages_column', this.metadataMappings.pages_column);
    formData.append('display_content_column', this.metadataMappings.display_content_column);

    this.titleLevels.forEach(lvl => {
      formData.append(`levelname_${lvl.level}`, lvl.name);
      formData.append(`levelvalue_${lvl.level}`, lvl.column);
    });

    this.http.post<any>('http://127.0.0.1:5000/api/documents/documents/upload_csv', formData, {
      reportProgress: true,
      observe: 'events'
    }).subscribe({
      next: (event: HttpEvent<any>) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadPhase.set('uploading');
          const percent = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
          this.progress.set(percent);
          if (percent === 100) {
            this.uploadPhase.set('indexing');
          }
        } else if (event.type === HttpEventType.Response) {
          const res = event.body;
          this.loading.set(false);
          this.uploadPhase.set('done');
          this.successMsg.set(res.message || 'Fichier indexé avec succès !');
          this.selectedFile = null;
          this.uploadParams.group_value = '';

          this.newColForm = {
            name: '',
            embedding_model: 'google/embeddinggemma-300m',
            description: ''
          };
          this.customModelPath = '';

          const fileInput = document.getElementById('csvFileInput') as HTMLInputElement;
          if (fileInput) fileInput.value = '';

          this.loadDocuments();
          this.loadGroupings();
          this.loadVectorCollections();
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.uploadPhase.set('idle');
        this.errorMsg.set(err.error?.error || "Une erreur est survenue lors de l'indexation.");
      }
    });
  }

  // --- RENAME MODAL METHODS ---
  openRenameModal(doc: UploadedDocument) {
    this.renamingDoc.set(doc);
    this.newDocName = doc.name;
    this.showRenameModal.set(true);
  }

  confirmRename() {
    const doc = this.renamingDoc();
    const newName = this.newDocName.trim();
    if (!doc || !newName || newName === doc.name) return;

    this.renameLoading.set(true);
    this.http.put<any>(`http://127.0.0.1:5000/api/documents/documents/${doc.id}/rename`, {
      new_name: newName
    }).subscribe({
      next: (res) => {
        this.renameLoading.set(false);
        this.showRenameModal.set(false);
        this.successMsg.set(res.message || 'Document renommé avec succès !');
        this.loadDocuments();
      },
      error: (err) => {
        this.renameLoading.set(false);
        this.errorMsg.set(err.error?.error || 'Erreur lors du renommage du document.');
      }
    });
  }

  getPhaseLabel(): string {
    switch (this.uploadPhase()) {
      case 'uploading':
        return 'Téléchargement du fichier CSV...';
      case 'indexing':
        return 'Vectorisation IA (ChromaDB) en cours...';
      case 'done':
        return 'Indexation terminée !';
      default:
        return 'Préparation...';
    }
  }

  deleteDoc(id: number) {
    if (!confirm('Voulez-vous masquer ce document de la liste ?')) return;
    this.http.delete(`http://127.0.0.1:5000/api/documents/documents/${id}`).subscribe({
      next: () => {
        this.loadDocuments();
        this.loadGroupings();
      },
      error: (err) => console.error(err)
    });
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
