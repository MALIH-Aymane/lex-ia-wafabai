import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface GroupingDoc {
  id: number;
  uuid: string;
  name: string;
  type: string;
  grouping: string;
  collection_name?: string;
  date?: string;
}


interface GroupingItem {
  grouping: string;
  document_count: number;
  collections: string[];
  documents: GroupingDoc[];
  expanded?: boolean;
}

@Component({
  selector: 'app-groupings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="groupings-page">
  <!-- Search & Actions Bar -->
  <div class="toolbar-row flex-between">
    <div class="search-box">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" class="search-input" [(ngModel)]="searchTerm" placeholder="Rechercher un grouping..." />
    </div>

    <div class="toolbar-right">
      <div class="stats-row">
        <div class="stat-pill">
          <span class="stat-num">{{ groupings().length }}</span>
          <span class="stat-lbl">Groupings</span>
        </div>
        <div class="stat-pill">
          <span class="stat-num">{{ getTotalDocuments() }}</span>
          <span class="stat-lbl">Documents</span>
        </div>
      </div>

      <button class="btn btn-primary" (click)="loadGroupings()" [disabled]="loading()">
        <span class="spinner-sm" *ngIf="loading()"></span>
        <span *ngIf="!loading()">🔄 Rafraîchir</span>
      </button>
    </div>
  </div>

  <!-- Alerts -->
  <div class="alert alert-error" *ngIf="error()">{{ error() }}</div>
  <div class="alert alert-success" *ngIf="successMsg()">{{ successMsg() }}</div>

  <!-- Loading State -->
  <div class="loading-state" *ngIf="loading() && groupings().length === 0">
    <div class="spinner"></div>
    <p>Chargement des groupings...</p>
  </div>

  <!-- Empty State -->
  <div class="empty-state" *ngIf="!loading() && filteredGroupings().length === 0">
    <div class="empty-icon">📂</div>
    <h3>Aucun grouping trouvé</h3>
    <p>Aucun groupe de documents n'a été créé ou trouvé pour votre recherche.</p>
  </div>

  <!-- Responsive Groupings Grid -->
  <div class="groupings-grid" *ngIf="filteredGroupings().length > 0">
    <div class="grouping-card card animate-fadeInUp"
         *ngFor="let g of filteredGroupings(); let i = index"
         [style.animation-delay]="i * 0.05 + 's'">
      
      <!-- Card Header -->
      <div class="card-header">
        <div class="group-title-info">
          <span class="group-icon">📂</span>
          <div class="group-name-box">
            <h3 class="group-name" [title]="g.grouping">{{ formatGrouping(g.grouping) }}</h3>
            <span class="group-sub">{{ g.document_count }} document(s) associé(s)</span>
          </div>
        </div>

        <span class="badge badge-navy flex-shrink-0">{{ g.document_count }} doc(s)</span>
      </div>

      <!-- Collections Badges -->
      <div class="collections-row" *ngIf="g.collections && g.collections.length > 0">
        <span class="collection-chip" *ngFor="let c of g.collections">📁 {{ c }}</span>
      </div>

      <!-- Actions Bar -->
      <div class="card-actions-row">
        <button class="btn btn-outline btn-xs" (click)="openRenameModal(g)">
          ✏️ Renommer
        </button>
        <button class="btn btn-outline btn-xs" (click)="g.expanded = !g.expanded">
          {{ g.expanded ? '▲ Masquer' : '📄 Voir docs (' + g.document_count + ')' }}
        </button>

        <button class="btn btn-danger-ghost btn-xs action-delete-btn" (click)="openDeleteModal(g, true)">
          🗑️ Supprimer (Cascade)
        </button>
      </div>

      <!-- Expandable Documents List -->
      <div class="documents-expand-panel animate-fadeIn" *ngIf="g.expanded">
        <h4 class="doc-panel-title">Documents dans ce grouping :</h4>

        <div class="doc-item-row" *ngFor="let doc of g.documents">
          <div class="doc-info">
            <span class="doc-icon">📄</span>
            <div class="doc-text">
              <span class="doc-filename">{{ doc.name }}</span>
              <span class="doc-meta" *ngIf="doc.collection_name">Collection: {{ doc.collection_name }}</span>
            </div>
          </div>

          <button class="btn btn-ghost btn-xs" (click)="openReassignModal(doc)">
            🔄 Reclasser
          </button>
        </div>
      </div>

    </div>
  </div>
</div>

<!-- RENAME GROUPING MODAL -->
<div class="modal-overlay" *ngIf="showRenameModal()" (click)="showRenameModal.set(false)">
  <div class="modal-box animate-fadeInUp" (click)="$event.stopPropagation()">
    <div class="modal-header flex-between">
      <h3>✏️ Renommer le Grouping</h3>
      <button class="modal-close" (click)="showRenameModal.set(false)">✕</button>
    </div>

    <div class="modal-body">
      <p class="modal-desc">
        Le renommage sera propagé automatiquement dans la base de données et dans les métadonnées de tous les vecteurs de ChromaDB.
      </p>

      <div class="form-group">
        <label class="form-label">Nom actuel :</label>
        <input type="text" class="form-control" [value]="selectedGroup()?.grouping" disabled />
      </div>

      <div class="form-group">
        <label class="form-label">Nouveau nom du grouping :</label>
        <input type="text" class="form-control" [(ngModel)]="newGroupingName" placeholder="Entrez le nouveau nom..." />
      </div>
    </div>

    <div class="modal-footer flex-between">
      <button class="btn btn-ghost" (click)="showRenameModal.set(false)">Annuler</button>
      <button class="btn btn-primary" (click)="submitRename()" [disabled]="actionLoading() || !newGroupingName.trim()">
        <span class="spinner-sm" *ngIf="actionLoading()"></span>
        <span *ngIf="!actionLoading()">Enregistrer & Propager</span>
      </button>
    </div>
  </div>
</div>

<!-- REASSIGN DOCUMENT MODAL -->
<div class="modal-overlay" *ngIf="showReassignModal()" (click)="showReassignModal.set(false)">
  <div class="modal-box animate-fadeInUp" (click)="$event.stopPropagation()">
    <div class="modal-header flex-between">
      <h3>🔄 Reclasser le Document</h3>
      <button class="modal-close" (click)="showReassignModal.set(false)">✕</button>
    </div>

    <div class="modal-body">
      <p class="modal-desc">
        Sélectionnez le nouveau grouping pour le document <strong>{{ selectedDoc()?.name }}</strong>.
      </p>

      <div class="form-group">
        <label class="form-label">Grouping cible :</label>
        <input type="text" class="form-control" [(ngModel)]="targetGroupingName" placeholder="Entrez ou sélectionnez un grouping..." list="existing-groupings-list" />
        <datalist id="existing-groupings-list">
          <option *ngFor="let item of groupings()" [value]="item.grouping">{{ item.grouping }}</option>
        </datalist>
      </div>
    </div>

    <div class="modal-footer flex-between">
      <button class="btn btn-ghost" (click)="showReassignModal.set(false)">Annuler</button>
      <button class="btn btn-primary" (click)="submitReassign()" [disabled]="actionLoading()">
        <span class="spinner-sm" *ngIf="actionLoading()"></span>
        <span *ngIf="!actionLoading()">Reclasser le document</span>
      </button>
    </div>
  </div>
</div>

<!-- DELETE / DISSOLVE GROUPING MODAL -->
<div class="modal-overlay" *ngIf="showDeleteModal()" (click)="showDeleteModal.set(false)">
  <div class="modal-box animate-fadeInUp" (click)="$event.stopPropagation()">
    <div class="modal-header flex-between">
      <h3 style="color:#dc2626">🗑️ Supprimer / Dissoudre le Grouping</h3>
      <button class="modal-close" (click)="showDeleteModal.set(false)">✕</button>
    </div>

    <div class="modal-body">
      <p class="modal-desc">
        Que souhaitez-vous faire avec le groupe <strong>{{ selectedGroup()?.grouping }}</strong> ({{ selectedGroup()?.document_count }} document(s)) ?
      </p>

      <div class="radio-option-card danger" [class.selected]="deleteCascade === true" (click)="deleteCascade = true">
        <input type="radio" name="deleteMode" [checked]="deleteCascade" />
        <div>
          <strong style="color:#dc2626">💣 Supprimer en cascade (Documents + Vecteurs ChromaDB)</strong>
          <p class="text-muted" style="font-size:12px; margin:2px 0 0 0">Supprime le groupe, masque tous les documents SQL associés et détruit tous leurs morceaux de vecteurs dans ChromaDB.</p>
        </div>
      </div>

      <div class="radio-option-card" [class.selected]="deleteCascade === false" (click)="deleteCascade = false">
        <input type="radio" name="deleteMode" [checked]="!deleteCascade" />
        <div>
          <strong>🔓 Dissoudre le groupe uniquement (Conserver les documents)</strong>
          <p class="text-muted" style="font-size:12px; margin:2px 0 0 0">Les documents et leurs vecteurs sont conservés sans grouping (grouping réinitialisé).</p>
        </div>
      </div>
    </div>

    <div class="modal-footer flex-between">
      <button class="btn btn-ghost" (click)="showDeleteModal.set(false)">Annuler</button>
      <button class="btn btn-danger" (click)="submitDelete()" [disabled]="actionLoading()">
        <span class="spinner-sm" *ngIf="actionLoading()"></span>
        <span *ngIf="!actionLoading()">Confirmer la suppression</span>
      </button>
    </div>
  </div>
</div>
  `,
  styles: [`
    .groupings-page { display: flex; flex-direction: column; gap: 20px; padding-bottom: 60px; }

    /* TOOLBAR & INLINE STATS */
    .toolbar-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 4px; }
    .search-box {
      display: flex; align-items: center; gap: 8px; background: #fff;
      border: 1.5px solid var(--border); border-radius: 12px; padding: 10px 16px; flex: 1; min-width: 260px; max-width: 480px;
    }
    .search-input { border: none; outline: none; width: 100%; font-size: 13.5px; color: var(--text); }

    .toolbar-right { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .stats-row { display: flex; gap: 10px; }
    .stat-pill {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 14px; background: rgba(0, 166, 147, 0.08); border-radius: 10px; border: 1px solid rgba(0, 166, 147, 0.2);
    }
    .stat-num { font-size: 15px; font-weight: 800; color: var(--primary-dark); }
    .stat-lbl { font-size: 11px; font-weight: 700; color: var(--navy); text-transform: uppercase; }

    /* RESPONSIVE GROUPINGS GRID */
    .groupings-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
    }
    @media (max-width: 1200px) { .groupings-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 768px)  { .groupings-grid { grid-template-columns: 1fr; } }

    .grouping-card {
      padding: 20px; border-radius: 16px; border: 1.5px solid var(--border-light);
      display: flex; flex-direction: column; gap: 14px; background: #ffffff;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      min-width: 0; word-break: break-word; overflow-wrap: break-word; max-width: 100%;
    }
    .grouping-card:hover {
      transform: translateY(-2px); box-shadow: 0 10px 28px rgba(10, 31, 78, 0.08); border-color: var(--primary-light);
    }

    .card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-width: 0; }
    .group-title-info { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
    .group-icon { font-size: 26px; flex-shrink: 0; }
    .group-name-box { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .group-name { font-size: 15px; font-weight: 700; color: var(--navy); margin: 0; word-break: break-word; overflow-wrap: break-word; line-height: 1.35; }
    .group-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

    .collections-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .collection-chip {
      font-size: 11px; padding: 2px 8px; border-radius: 99px; background: rgba(10,31,78,.05); color: var(--navy); font-weight: 600;
      word-break: break-word;
    }

    .card-actions-row {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      padding-top: 10px; border-top: 1px solid var(--border-light);
    }
    .action-delete-btn { margin-left: auto; color: #dc2626; }
    @media (max-width: 480px) { .action-delete-btn { margin-left: 0; } }

    .btn-danger-ghost { background: none; border: none; color: #dc2626; font-weight: 600; cursor: pointer; }
    .btn-danger-ghost:hover { text-decoration: underline; }

    /* EXPAND PANEL */
    .documents-expand-panel {
      margin-top: 10px; padding: 14px; background: var(--bg); border-radius: 10px; border: 1px solid var(--border-light); min-width: 0;
    }
    .doc-panel-title { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin: 0 0 10px 0; }
    .doc-item-row {
      display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
      padding: 8px 0; border-bottom: 1px dashed var(--border-light); min-width: 0;
    }
    .doc-item-row:last-child { border-bottom: none; }
    .doc-info { display: flex; align-items: flex-start; gap: 8px; flex: 1; min-width: 0; }
    .doc-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .doc-filename { font-size: 13px; font-weight: 600; color: var(--text); word-break: break-word; overflow-wrap: break-word; }
    .doc-meta { font-size: 11px; color: var(--text-muted); display: block; word-break: break-word; }

    /* ALERTS */
    .alert { padding: 12px 16px; border-radius: 10px; font-size: 13.5px; }
    .alert-error { background: rgba(239,68,68,.1); color: #dc2626; border: 1px solid rgba(239,68,68,.2); }
    .alert-success { background: rgba(16,185,129,.1); color: #047857; border: 1px solid rgba(16,185,129,.2); }

    /* MODAL STYLES */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;
      display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px);
    }
    .modal-box {
      background: #ffffff; border-radius: 20px; padding: 28px; width: 100%; max-width: 520px;
      box-shadow: 0 20px 50px rgba(10,31,78,0.25); display: flex; flex-direction: column; gap: 16px;
    }
    .modal-header h3 { font-size: 17px; font-weight: 700; color: var(--navy); margin: 0; }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-muted); }
    .modal-desc { font-size: 13px; color: var(--text-muted); line-height: 1.5; margin: 0 0 16px 0; }

    .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .form-label { font-size: 12px; font-weight: 700; color: var(--navy); }
    .form-control {
      padding: 10px 14px; border: 1.5px solid var(--border); border-radius: 8px; font-size: 13.5px; outline: none;
    }
    .form-control:focus { border-color: var(--primary); }

    .radio-option-card {
      display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1.5px solid var(--border);
      border-radius: 12px; cursor: pointer; margin-bottom: 10px; transition: var(--transition);
    }
    .radio-option-card.selected { border-color: var(--primary); background: rgba(0,166,147,0.04); }
    .radio-option-card.danger.selected { border-color: #dc2626; background: rgba(239,68,68,0.04); }
  `]
})
export class GroupingsComponent implements OnInit {
  groupings = signal<GroupingItem[]>([]);
  loading = signal(false);
  actionLoading = signal(false);
  error = signal('');
  successMsg = signal('');
  searchTerm = '';

  // Modals state
  showRenameModal = signal(false);
  showReassignModal = signal(false);
  showDeleteModal = signal(false);

  selectedGroup = signal<GroupingItem | null>(null);
  selectedDoc = signal<GroupingDoc | null>(null);

  newGroupingName = '';
  targetGroupingName = '';
  deleteCascade = true;

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.loadGroupings();
  }

  loadGroupings() {
    this.loading.set(true);
    this.error.set('');
    this.http.get<any>(`${environment.apiUrl}/api/documents/db/groupings`).subscribe({
      next: (res) => {
        this.groupings.set(res.groupings || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Impossible de charger les groupings.');
        this.loading.set(false);
      }
    });
  }

  getTotalDocuments(): number {
    return this.groupings().reduce((acc, g) => acc + g.document_count, 0);
  }

  filteredGroupings(): GroupingItem[] {
    const query = this.searchTerm.toLowerCase().trim();
    if (!query) return this.groupings();
    return this.groupings().filter(g => g.grouping.toLowerCase().includes(query));
  }

  formatGrouping(val: any): string {
    if (!val) return '';
    const str = String(val).trim();
    if (str.length <= 12) return str;

    const first10 = str.slice(0, 10);
    const words = str.split(/[\s_\-\/\.]+/).filter(w => w.length > 0);
    const initials = words.map(w => w.charAt(0).toUpperCase()).join('');

    return `${first10}.... (${initials})`;
  }

  // Rename Modal
  openRenameModal(g: GroupingItem) {
    this.selectedGroup.set(g);
    this.newGroupingName = g.grouping;
    this.showRenameModal.set(true);
  }

  submitRename() {
    if (!this.selectedGroup() || !this.newGroupingName.trim()) return;
    this.actionLoading.set(true);
    this.error.set('');
    this.successMsg.set('');

    const payload = {
      old_name: this.selectedGroup()!.grouping,
      new_name: this.newGroupingName.trim()
    };

    this.http.put<any>(`${environment.apiUrl}/api/documents/db/groupings/rename`, payload).subscribe({
      next: (res) => {
        this.successMsg.set(res.message || 'Grouping renommé avec succès.');
        this.actionLoading.set(false);
        this.showRenameModal.set(false);
        this.loadGroupings();
        setTimeout(() => this.successMsg.set(''), 4000);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors du renommage.');
        this.actionLoading.set(false);
      }
    });
  }

  // Reassign Modal
  openReassignModal(doc: GroupingDoc) {
    this.selectedDoc.set(doc);
    this.targetGroupingName = doc.grouping || '';
    this.showReassignModal.set(true);
  }

  submitReassign() {
    if (!this.selectedDoc()) return;
    this.actionLoading.set(true);
    this.error.set('');

    const docId = this.selectedDoc()!.id;
    const payload = { grouping: this.targetGroupingName.trim() };

    this.http.put<any>(`${environment.apiUrl}/api/documents/${docId}/grouping`, payload).subscribe({
      next: (res) => {
        this.successMsg.set(res.message || 'Document reclassé.');
        this.actionLoading.set(false);
        this.showReassignModal.set(false);
        this.loadGroupings();
        setTimeout(() => this.successMsg.set(''), 4000);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors du reclassement.');
        this.actionLoading.set(false);
      }
    });
  }

  // Delete Modal
  openDeleteModal(g: GroupingItem, isCascade: boolean = true) {
    this.selectedGroup.set(g);
    this.deleteCascade = isCascade;
    this.showDeleteModal.set(true);
  }

  submitDelete() {
    if (!this.selectedGroup()) return;
    this.actionLoading.set(true);
    this.error.set('');

    const grpName = encodeURIComponent(this.selectedGroup()!.grouping);
    const url = `${environment.apiUrl}/api/documents/db/groupings/${grpName}?cascade=${this.deleteCascade}`;

    this.http.delete<any>(url).subscribe({
      next: (res) => {
        this.successMsg.set(res.message || 'Grouping et vecteurs supprimés.');
        this.actionLoading.set(false);
        this.showDeleteModal.set(false);
        this.loadGroupings();
        setTimeout(() => this.successMsg.set(''), 4000);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Erreur lors de la suppression.');
        this.actionLoading.set(false);
      }
    });
  }
}
