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
  templateUrl: './groupings.component.html',
  styleUrls: ['./groupings.component.scss'],
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
