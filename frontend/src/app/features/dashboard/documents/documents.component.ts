import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

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
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss'],
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

    this.http.get<any>(`${environment.apiUrl}/api/documents/documents`, { params }).subscribe({
      next: (res) => {
        this.documents.set(res.documents || []);
        this.totalItems.set(res.total_items ?? (res.documents || []).length);
        this.totalPages.set(res.total_pages ?? 1);
      },
      error: (err) => console.error(err)
    });
  }

  loadGroupings() {
    this.http.get<any>(`${environment.apiUrl}/api/documents/documents/groupings`).subscribe({
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
    this.http.get<any>(`${environment.apiUrl}/api/documents/vector-collections`).subscribe({
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

      this.http.post<any>(`${environment.apiUrl}/api/documents/vector-collections`, createPayload)
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

    this.http.post<any>(`${environment.apiUrl}/api/documents/documents/upload_csv`, formData, {
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
    this.http.put<any>(`${environment.apiUrl}/api/documents/documents/${doc.id}/rename`, {
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
    this.http.delete(`${environment.apiUrl}/api/documents/documents/${id}`).subscribe({
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
