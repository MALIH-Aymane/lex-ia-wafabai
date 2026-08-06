import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

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
  templateUrl: './db-manager.component.html',
  styleUrls: ['./db-manager.component.scss'],
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
    this.http.get<any>('http://127.0.0.1:5000/api/documents/db/collections').subscribe({
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
    this.http.get<any>(`http://127.0.0.1:5000/api/documents/db/collections/${name}/metadata_keys`).subscribe({
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

      this.http.post<any>(`http://127.0.0.1:5000/api/documents/db/collections/${name}/query`, payload).subscribe({
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

      this.http.post<any>(`http://127.0.0.1:5000/api/documents/db/collections/${name}/peek`, payload).subscribe({
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

    const url = `http://127.0.0.1:5000/api/documents/db/collections/${colName}/records/${this.editingRecord.id}`;

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

    this.http.delete(`http://127.0.0.1:5000/api/documents/db/collections/${name}`).subscribe({
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

    this.http.delete(`http://127.0.0.1:5000/api/documents/db/collections/${colName}/records/${id}`).subscribe({
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
