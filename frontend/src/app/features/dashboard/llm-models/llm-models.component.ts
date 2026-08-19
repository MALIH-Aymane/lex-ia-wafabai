import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

interface LLMModel {
  id: number;
  name: string;
  provider: string;
  endpoint: string | null;
  api_key?: string;
  is_active: boolean;
  is_default: boolean;
  temperature: number;
  max_tokens: number;
  testing?: boolean;
  testResult?: { status: 'success' | 'error'; message: string; response?: string; time_taken_seconds?: number };
}

const PROVIDERS = [
  { value: 'openai',    label: 'OpenAI',    icon: '🤖', color: '#10a37f' },
  { value: 'ollama',   label: 'Ollama',    icon: '🦙', color: '#ff7a00' },
  { value: 'gemini',   label: 'Gemini',    icon: '✨', color: '#4285F4' },
  { value: 'deepseek', label: 'DeepSeek',  icon: '🔍', color: '#6c5ce7' },
];

function emptyModel(): Partial<LLMModel> {
  return { name: '', provider: 'ollama', endpoint: '', api_key: '', temperature: 0.7, max_tokens: 2048, is_active: true, is_default: false };
}

@Component({
  selector: 'app-llm-models',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './llm-models.component.html',
  styleUrls: ['./llm-models.component.scss'],
})
export class LlmModelsComponent implements OnInit {

  readonly API = `${environment.apiUrl}/api/llm_models/llm-models`;

  models    = signal<LLMModel[]>([]);
  loading   = signal(true);
  saving    = signal(false);
  successMsg = signal('');
  errorMsg   = signal('');

  showModal   = signal(false);
  editMode    = signal(false);
  deleteTarget = signal<LLMModel | null>(null);

  providerFilter = signal('');

  form: Partial<LLMModel> = emptyModel();
  showKey = false;

  providers = PROVIDERS;

  activeCount = computed(() => this.models().filter(m => m.is_active).length);
  uniqueProviders = computed(() => new Set(this.models().map(m => m.provider)).size);
  defaultModel = computed(() => this.models().find(m => m.is_default));

  filteredModels = computed(() => {
    const pf = this.providerFilter();
    return pf ? this.models().filter(m => m.provider === pf) : this.models();
  });

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit() { this.loadModels(); }

  providerColor(p: string): string {
    return PROVIDERS.find(x => x.value === p)?.color ?? '#6c757d';
  }
  providerIcon(p: string): string {
    return PROVIDERS.find(x => x.value === p)?.icon ?? '🤖';
  }

  private headers(): HttpHeaders {
    const token = this.auth.token() || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadModels() {
    this.loading.set(true);
    this.http.get<LLMModel[]>(this.API, { headers: this.headers() }).subscribe({
      next: ms => { this.models.set(ms); this.loading.set(false); },
      error: () => { this.loading.set(false); this.showError('Impossible de charger les modèles.'); }
    });
  }

  openCreate() {
    this.form = emptyModel();
    this.editMode.set(false);
    this.showModal.set(true);
  }

  openEdit(m: LLMModel) {
    this.form = { ...m };
    this.editMode.set(true);
    this.showModal.set(true);
  }

  closeModal(event?: MouseEvent) {
    if (event && !(event.target as HTMLElement).classList.contains('modal-overlay')) return;
    this.showModal.set(false);
  }

  saveModel() {
    if (!this.form.name || !this.form.provider) return;
    this.saving.set(true);
    const payload = { ...this.form };

    const req = this.editMode()
      ? this.http.put<any>(`${this.API}/${this.form.id}`, payload, { headers: this.headers() })
      : this.http.post<any>(this.API, payload, { headers: this.headers() });

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.loadModels();
        this.showSuccess(this.editMode() ? 'Modèle mis à jour avec succès.' : 'Modèle créé avec succès.');
      },
      error: (err) => {
        this.saving.set(false);
        this.showError(err.error?.error || 'Erreur lors de la sauvegarde.');
      }
    });
  }

  toggleModel(m: LLMModel) {
    this.http.patch<any>(`${this.API}/${m.id}/toggle`, {}, { headers: this.headers() }).subscribe({
      next: (res) => {
        this.models.update(ms => ms.map(x => x.id === m.id ? { ...x, is_active: res.model.is_active } : x));
        this.showSuccess(`Modèle ${res.model.is_active ? 'activé' : 'désactivé'}.`);
      },
      error: () => this.showError('Erreur lors du changement de statut.')
    });
  }

  setDefault(m: LLMModel) {
    this.http.patch<any>(`${this.API}/${m.id}/default`, {}, { headers: this.headers() }).subscribe({
      next: (res) => {
        this.loadModels();
        this.showSuccess(`Le modèle "${res.model.name}" est désormais le modèle par défaut.`);
      },
      error: () => this.showError('Erreur lors de la définition du modèle par défaut.')
    });
  }

  testModel(m: LLMModel) {
    this.models.update(ms => ms.map(x => x.id === m.id ? { ...x, testing: true, testResult: undefined } : x));
    this.http.post<any>(`${this.API}/${m.id}/test`, {}, { headers: this.headers() }).subscribe({
      next: (res) => {
        this.models.update(ms => ms.map(x => x.id === m.id ? { ...x, testing: false, testResult: res } : x));
      },
      error: (err) => {
        const errorMsg = err.error?.message || 'Erreur réseau de communication avec le modèle.';
        this.models.update(ms => ms.map(x => x.id === m.id ? { ...x, testing: false, testResult: { status: 'error', message: errorMsg } } : x));
      }
    });
  }

  confirmDelete(m: LLMModel) { this.deleteTarget.set(m); }
  cancelDelete(event?: MouseEvent) {
    if (event && !(event.target as HTMLElement).classList.contains('modal-overlay')) return;
    this.deleteTarget.set(null);
  }

  deleteModel() {
    const m = this.deleteTarget();
    if (!m) return;
    this.saving.set(true);
    this.http.delete<any>(`${this.API}/${m.id}`, { headers: this.headers() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.deleteTarget.set(null);
        this.loadModels();
        this.showSuccess(`Modèle "${m.name}" supprimé.`);
      },
      error: () => { this.saving.set(false); this.showError('Erreur lors de la suppression.'); }
    });
  }

  private showSuccess(msg: string) {
    this.successMsg.set(msg);
    this.errorMsg.set('');
    setTimeout(() => this.successMsg.set(''), 4000);
  }
  private showError(msg: string) {
    this.errorMsg.set(msg);
    setTimeout(() => this.errorMsg.set(''), 6000);
  }
}
