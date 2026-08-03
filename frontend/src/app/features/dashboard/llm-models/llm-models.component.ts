import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';

interface LLMModel {
  id: number;
  name: string;
  provider: string;
  endpoint: string | null;
  api_key?: string;
  is_active: boolean;
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
  return { name: '', provider: 'ollama', endpoint: '', api_key: '', temperature: 0.7, max_tokens: 2048, is_active: true };
}

@Component({
  selector: 'app-llm-models',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="llm-page">

  <!-- ── Top stats bar ─────────────────────────────────── -->
  <div class="stats-row">
    <div class="stat-card">
      <span class="stat-icon">🤖</span>
      <div class="stat-body">
        <div class="stat-val">{{ models().length }}</div>
        <div class="stat-lbl">Modèles configurés</div>
      </div>
    </div>
    <div class="stat-card">
      <span class="stat-icon">✅</span>
      <div class="stat-body">
        <div class="stat-val">{{ activeCount() }}</div>
        <div class="stat-lbl">Modèles actifs</div>
      </div>
    </div>
    <div class="stat-card">
      <span class="stat-icon">🏷️</span>
      <div class="stat-body">
        <div class="stat-val">{{ uniqueProviders() }}</div>
        <div class="stat-lbl">Fournisseurs</div>
      </div>
    </div>
    <div class="stat-card stat-card-action">
      <button class="btn btn-primary btn-add" (click)="openCreate()">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Ajouter un modèle
      </button>
    </div>
  </div>

  <!-- ── Alert ─────────────────────────────────────────── -->
  <div class="alert alert-success animate-fadeIn" *ngIf="successMsg()">
    ✅ {{ successMsg() }}
  </div>
  <div class="alert alert-error animate-fadeIn" *ngIf="errorMsg()">
    ❌ {{ errorMsg() }}
  </div>

  <!-- ── Models Grid ──────────────────────────────────── -->
  <div class="section-header">
    <h2 class="section-title">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
      Modèles LLM Configurés
    </h2>
    <div class="filter-pills">
      <button class="pill" [class.pill-active]="providerFilter() === ''" (click)="providerFilter.set('')">Tous</button>
      <button class="pill" *ngFor="let p of providers" [class.pill-active]="providerFilter() === p.value" (click)="providerFilter.set(p.value)">
        {{ p.icon }} {{ p.label }}
      </button>
    </div>
  </div>

  <div class="loading-state" *ngIf="loading()">
    <span class="spinner-lg"></span>
    <span>Chargement des modèles…</span>
  </div>

  <div class="empty-state" *ngIf="!loading() && filteredModels().length === 0">
    <div class="empty-icon">🤖</div>
    <h3>Aucun modèle configuré</h3>
    <p>Ajoutez votre premier modèle LLM pour démarrer.</p>
    <button class="btn btn-primary" (click)="openCreate()">+ Ajouter un modèle</button>
  </div>

  <div class="models-grid" *ngIf="!loading() && filteredModels().length > 0">
    <div class="model-card animate-fadeInUp"
         *ngFor="let m of filteredModels(); let i = index"
         [class.model-card-inactive]="!m.is_active"
         [style.animation-delay]="i * 0.05 + 's'">

      <!-- Card top ribbon -->
      <div class="card-ribbon" [style.background]="providerColor(m.provider)"></div>

      <div class="card-header">
        <div class="provider-badge" [style.background]="providerColor(m.provider) + '22'" [style.color]="providerColor(m.provider)">
          {{ providerIcon(m.provider) }} {{ m.provider | titlecase }}
        </div>
        <div class="status-toggle" (click)="toggleModel(m)" [title]="m.is_active ? 'Désactiver' : 'Activer'">
          <div class="toggle-track" [class.toggle-on]="m.is_active">
            <div class="toggle-knob"></div>
          </div>
          <span class="toggle-label">{{ m.is_active ? 'Actif' : 'Inactif' }}</span>
        </div>
      </div>

      <div class="card-body">
        <h3 class="model-name">{{ m.name }}</h3>
        <div class="model-meta" *ngIf="m.endpoint">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span class="endpoint-text" [title]="m.endpoint">{{ m.endpoint }}</span>
        </div>

        <div class="model-params">
          <div class="param-chip">
            <span class="param-lbl">Température</span>
            <span class="param-val">{{ m.temperature }}</span>
          </div>
          <div class="param-chip">
            <span class="param-lbl">Max Tokens</span>
            <span class="param-val">{{ m.max_tokens }}</span>
          </div>
        </div>

        <!-- Test Connection Result Display -->
        <div class="test-result-box" *ngIf="m.testResult" [class.tr-success]="m.testResult.status === 'success'" [class.tr-error]="m.testResult.status === 'error'">
          <div class="tr-header">
            <span class="tr-indicator"></span>
            <strong>{{ m.testResult.status === 'success' ? 'Connexion Réussie' : 'Échec de connexion' }}</strong>
            <span class="tr-time" *ngIf="m.testResult.time_taken_seconds">{{ m.testResult.time_taken_seconds }}s</span>
            <button class="tr-close" (click)="m.testResult = undefined">✕</button>
          </div>
          <p class="tr-desc" *ngIf="m.testResult.response">"{{ m.testResult.response }}"</p>
          <p class="tr-desc" *ngIf="m.testResult.status === 'error'">{{ m.testResult.message }}</p>
        </div>
      </div>

      <div class="card-footer" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px">
        <button class="btn-icon btn-icon-test" (click)="testModel(m)" [disabled]="m.testing" title="Tester la connexion">
          <span class="spinner-sm" *ngIf="m.testing"></span>
          <svg *ngIf="!m.testing" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          {{ m.testing ? 'Test en cours…' : 'Tester' }}
        </button>
        <div style="display:flex; gap:8px; margin-left:auto">
          <button class="btn-icon btn-icon-edit" (click)="openEdit(m)" title="Modifier">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Modifier
          </button>
          <button class="btn-icon btn-icon-delete" (click)="confirmDelete(m)" title="Supprimer">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Supprimer
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════
       CREATE / EDIT MODAL
  ═══════════════════════════════════════════════════ -->
  <div class="modal-overlay" *ngIf="showModal()" (click)="closeModal($event)">
    <div class="modal-box animate-scaleIn">
      <div class="modal-header">
        <div class="modal-title-row">
          <span class="modal-icon">{{ editMode() ? '✏️' : '➕' }}</span>
          <h2>{{ editMode() ? 'Modifier le modèle' : 'Nouveau modèle LLM' }}</h2>
        </div>
        <button class="modal-close" (click)="closeModal()">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Provider selection -->
        <div class="form-field">
          <label class="form-label">Fournisseur *</label>
          <div class="provider-cards">
            <div class="provider-card"
                 *ngFor="let p of providers"
                 [class.provider-card-selected]="form.provider === p.value"
                 [style.border-color]="form.provider === p.value ? p.color : 'transparent'"
                 (click)="form.provider = p.value">
              <span class="provider-emoji">{{ p.icon }}</span>
              <span class="provider-name">{{ p.label }}</span>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Nom du modèle *</label>
            <input class="form-input" [(ngModel)]="form.name" placeholder="ex: llama3, gpt-4o-mini, gemini-pro" />
            <span class="form-hint">Identifiant exact utilisé par le fournisseur.</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Endpoint (URL API)</label>
            <input class="form-input" [(ngModel)]="form.endpoint" placeholder="ex: http://localhost:11434/api" />
            <span class="form-hint">Laisser vide pour utiliser l'endpoint par défaut.</span>
          </div>
          <div class="form-field">
            <label class="form-label">Clé API</label>
            <div class="input-eye-wrap">
              <input class="form-input" [type]="showKey ? 'text' : 'password'" [(ngModel)]="form.api_key" placeholder="sk-…" />
              <button class="eye-btn" type="button" (click)="showKey = !showKey">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path *ngIf="!showKey" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle *ngIf="!showKey" cx="12" cy="12" r="3"/>
                  <path *ngIf="showKey" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line *ngIf="showKey" x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Température <span class="param-badge">{{ form.temperature }}</span></label>
            <input class="form-range" type="range" min="0" max="2" step="0.05" [(ngModel)]="form.temperature" />
            <div class="range-labels"><span>0 (Précis)</span><span>2 (Créatif)</span></div>
          </div>
          <div class="form-field">
            <label class="form-label">Max Tokens</label>
            <input class="form-input" type="number" min="256" max="32768" step="256" [(ngModel)]="form.max_tokens" />
          </div>
        </div>

        <div class="form-field form-field-toggle">
          <label class="form-label">Statut</label>
          <div class="status-toggle status-toggle-lg" (click)="form.is_active = !form.is_active">
            <div class="toggle-track" [class.toggle-on]="form.is_active">
              <div class="toggle-knob"></div>
            </div>
            <span class="toggle-label">{{ form.is_active ? '✅ Actif – sera disponible pour la recherche' : '⏸️ Inactif – non disponible' }}</span>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" (click)="closeModal()">Annuler</button>
        <button class="btn btn-primary" (click)="saveModel()" [disabled]="saving() || !form.name || !form.provider">
          <span class="spinner" *ngIf="saving()"></span>
          {{ saving() ? 'Enregistrement…' : (editMode() ? 'Mettre à jour' : 'Créer le modèle') }}
        </button>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════
       DELETE CONFIRMATION MODAL
  ═══════════════════════════════════════════════════ -->
  <div class="modal-overlay" *ngIf="deleteTarget()" (click)="cancelDelete($event)">
    <div class="modal-box modal-box-sm animate-scaleIn">
      <div class="modal-header">
        <div class="modal-title-row">
          <span class="modal-icon">🗑️</span>
          <h2>Supprimer le modèle</h2>
        </div>
        <button class="modal-close" (click)="cancelDelete()">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="delete-warning">
          <div class="delete-warning-icon">⚠️</div>
          <p>Vous êtes sur le point de supprimer définitivement le modèle :</p>
          <strong class="delete-target-name">{{ deleteTarget()?.name }}</strong>
          <p class="delete-note">Cette action est irréversible. Les recherches utilisant ce modèle pourraient être affectées.</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" (click)="cancelDelete()">Annuler</button>
        <button class="btn btn-danger" (click)="deleteModel()" [disabled]="saving()">
          <span class="spinner" *ngIf="saving()"></span>
          {{ saving() ? 'Suppression…' : '🗑️ Supprimer définitivement' }}
        </button>
      </div>
    </div>
  </div>

</div>
  `,
  styles: [`
    .llm-page { padding: 24px; display: flex; flex-direction: column; gap: 24px; }

    /* ── Stats Row ─────────────────────────────── */
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .stat-card {
      background: #fff; border: 1px solid #e9ecef; border-radius: 14px; padding: 20px;
      display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 8px rgba(10,31,78,.06);
    }
    .stat-icon { font-size: 28px; line-height: 1; }
    .stat-body { display: flex; flex-direction: column; gap: 2px; }
    .stat-val { font-size: 28px; font-weight: 800; color: #0a1f4e; line-height: 1; }
    .stat-lbl { font-size: 12px; color: #6c757d; font-weight: 500; }
    .stat-card-action { justify-content: center; background: linear-gradient(135deg, #ff7a00 0%, #ff9a3c 100%); border: none; }
    .btn-add { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }

    /* ── Alerts ──────────────────────────────────── */
    .alert { padding: 12px 16px; border-radius: 10px; font-size: 14px; font-weight: 500; }
    .alert-success { background: rgba(16,163,127,.12); color: #10a37f; border: 1px solid rgba(16,163,127,.3); }
    .alert-error   { background: rgba(239,68,68,.12);  color: #ef4444; border: 1px solid rgba(239,68,68,.3);  }

    /* ── Section Header & Filter Pills ─────────── */
    .section-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .section-title { font-size: 17px; font-weight: 700; color: #0a1f4e; display: flex; align-items: center; gap: 8px; margin: 0; }
    .filter-pills { display: flex; gap: 8px; flex-wrap: wrap; }
    .pill { padding: 5px 14px; border-radius: 99px; border: 1.5px solid #e9ecef; background: #f8f9fa; font-size: 13px; font-weight: 500; color: #6c757d; cursor: pointer; transition: all .18s; }
    .pill:hover { border-color: #ff7a00; color: #ff7a00; }
    .pill-active { background: #ff7a00; border-color: #ff7a00; color: #fff; }

    /* ── Loading / Empty ─────────────────────── */
    .loading-state, .empty-state { text-align: center; padding: 60px 24px; color: #adb5bd; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .spinner-lg { width: 40px; height: 40px; border: 4px solid rgba(255,122,0,.2); border-top-color: #ff7a00; border-radius: 50%; animation: spin .7s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-icon { font-size: 52px; }
    .empty-state h3 { font-size: 20px; font-weight: 700; color: #495057; margin: 0; }
    .empty-state p { font-size: 14px; margin: 0; }

    /* ── Models Grid ─────────────────────────── */
    .models-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
    .model-card {
      background: #fff; border: 1px solid #e9ecef; border-radius: 16px; overflow: hidden;
      box-shadow: 0 2px 12px rgba(10,31,78,.06); transition: transform .2s, box-shadow .2s; position: relative;
      display: flex; flex-direction: column;
    }
    .model-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(10,31,78,.12); }
    .model-card-inactive { opacity: .6; }
    .card-ribbon { height: 4px; width: 100%; }
    .card-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 0; }
    .provider-badge { padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; }
    .status-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
    .toggle-track { width: 36px; height: 20px; border-radius: 99px; background: #dee2e6; position: relative; transition: background .2s; }
    .toggle-track.toggle-on { background: #ff7a00; }
    .toggle-knob { width: 16px; height: 16px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: transform .2s; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
    .toggle-track.toggle-on .toggle-knob { transform: translateX(16px); }
    .toggle-label { font-size: 11px; font-weight: 600; color: #6c757d; }
    .card-body { padding: 12px 16px; flex: 1; }
    .model-name { font-size: 16px; font-weight: 700; color: #0a1f4e; margin: 0 0 6px; word-break: break-all; }
    .model-meta { display: flex; align-items: center; gap: 5px; margin-bottom: 12px; }
    .endpoint-text { font-size: 11px; color: #6c757d; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
    .model-params { display: flex; gap: 8px; flex-wrap: wrap; }
    .param-chip { display: flex; flex-direction: column; padding: 5px 10px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef; }
    .param-lbl { font-size: 10px; color: #adb5bd; font-weight: 600; text-transform: uppercase; }
    .param-val { font-size: 14px; font-weight: 700; color: #0a1f4e; }
    .card-footer { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #f1f3f5; }
    .btn-icon { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .18s; border: 1.5px solid; }
    .btn-icon-edit  { color: #ff7a00; border-color: rgba(255,122,0,.3); background: rgba(255,122,0,.06); }
    .btn-icon-edit:hover { background: rgba(255,122,0,.15); }
    .btn-icon-delete { color: #ef4444; border-color: rgba(239,68,68,.3); background: rgba(239,68,68,.06); }
    .btn-icon-delete:hover { background: rgba(239,68,68,.15); }
    .btn-icon-test { color: #ff7a00; border-color: rgba(255,122,0,.3); background: rgba(255,122,0,.04); }
    .btn-icon-test:hover { background: rgba(255,122,0,.12); }
    .btn-icon-test:disabled { opacity: 0.7; cursor: not-allowed; }
    
    .test-result-box {
      margin-top: 12px; padding: 10px 12px; border-radius: 10px; font-size: 12px; border: 1px solid;
    }
    .test-result-box.tr-success {
      background: rgba(16,163,127,.05); border-color: rgba(16,163,127,.2); color: #10a37f;
    }
    .test-result-box.tr-error {
      background: rgba(239,68,68,.05); border-color: rgba(239,68,68,.2); color: #ef4444;
    }
    .tr-header { display: flex; align-items: center; gap: 6px; font-weight: 700; margin-bottom: 4px; position: relative; }
    .tr-indicator { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
    .tr-success .tr-indicator { background: #10a37f; }
    .tr-error .tr-indicator { background: #ef4444; }
    .tr-time { margin-left: auto; font-size: 10px; color: #6c757d; font-weight: 500; }
    .tr-close { background: none; border: none; cursor: pointer; color: inherit; font-size: 10px; padding: 2px; line-height: 1; opacity: 0.6; margin-left: 6px; }
    .tr-close:hover { opacity: 1; }
    .tr-desc { margin: 0; font-family: monospace; font-size: 11px; line-height: 1.4; word-break: break-all; opacity: 0.85; }
    
    .spinner-sm { width: 12px; height: 12px; border: 1.5px solid rgba(255,122,0,.4); border-top-color: #ff7a00; border-radius: 50%; animation: spin .7s linear infinite; display: inline-block; }

    /* ── Modal ───────────────────────────────── */
    .modal-overlay { position: fixed; inset: 0; background: rgba(10,31,78,.45); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .modal-box { background: #fff; border-radius: 20px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(10,31,78,.2); }
    .modal-box-sm { max-width: 440px; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 0; }
    .modal-title-row { display: flex; align-items: center; gap: 10px; }
    .modal-icon { font-size: 22px; }
    .modal-header h2 { font-size: 18px; font-weight: 700; color: #0a1f4e; margin: 0; }
    .modal-close { width: 32px; height: 32px; border-radius: 8px; background: #f8f9fa; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6c757d; transition: background .18s; }
    .modal-close:hover { background: #e9ecef; }
    .modal-body { padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; }
    .modal-footer { padding: 16px 28px 24px; display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #f1f3f5; }

    /* ── Form Elements ───────────────────────── */
    .form-field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .form-row { display: flex; gap: 16px; }
    .form-label { font-size: 13px; font-weight: 600; color: #0a1f4e; display: flex; align-items: center; gap: 8px; }
    .param-badge { padding: 2px 8px; background: #ff7a00; color: #fff; border-radius: 99px; font-size: 11px; font-weight: 700; }
    .form-input { padding: 10px 14px; border: 1.5px solid #e9ecef; border-radius: 10px; font-size: 14px; outline: none; transition: border-color .18s; background: #f8f9fa; color: #0a1f4e; width: 100%; box-sizing: border-box; }
    .form-input:focus { border-color: #ff7a00; background: #fff; }
    .form-hint { font-size: 11px; color: #adb5bd; }
    .form-range { width: 100%; accent-color: #ff7a00; cursor: pointer; }
    .range-labels { display: flex; justify-content: space-between; font-size: 11px; color: #adb5bd; }
    .input-eye-wrap { position: relative; }
    .input-eye-wrap .form-input { padding-right: 40px; }
    .eye-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #adb5bd; padding: 4px; }
    .form-field-toggle { flex-direction: row; align-items: center; gap: 16px; }
    .status-toggle-lg { gap: 10px; }

    /* Provider cards selector */
    .provider-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .provider-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; border: 2px solid #e9ecef; border-radius: 12px; cursor: pointer; transition: all .18s; background: #f8f9fa; }
    .provider-card:hover { border-color: #ff7a00; background: rgba(255,122,0,.04); }
    .provider-card-selected { background: rgba(255,122,0,.06) !important; }
    .provider-emoji { font-size: 24px; }
    .provider-name { font-size: 11px; font-weight: 600; color: #495057; }

    /* Delete warning */
    .delete-warning { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .delete-warning-icon { font-size: 48px; }
    .delete-warning p { font-size: 14px; color: #6c757d; margin: 0; }
    .delete-target-name { font-size: 18px; font-weight: 700; color: #0a1f4e; word-break: break-all; }
    .delete-note { font-size: 12px; color: #adb5bd; }

    /* Buttons */
    .btn { padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 8px; transition: all .18s; }
    .btn-primary { background: linear-gradient(135deg, #ff7a00, #ff9a3c); color: #fff; }
    .btn-primary:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
    .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
    .btn-ghost { background: #f8f9fa; color: #6c757d; border: 1.5px solid #e9ecef; }
    .btn-ghost:hover { background: #e9ecef; }
    .btn-danger { background: #ef4444; color: #fff; }
    .btn-danger:hover:not(:disabled) { background: #dc2626; }
    .btn-danger:disabled { opacity: .6; cursor: not-allowed; }

    /* Spinner */
    .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; display: inline-block; }

    /* Animations */
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-fadeIn { animation: fadeIn .3s ease both; }
    .animate-fadeInUp { animation: fadeInUp .4s ease both; }
    .animate-scaleIn { animation: scaleIn .2s ease both; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(.95); } to { opacity: 1; transform: scale(1); } }

    @media (max-width: 600px) {
      .form-row { flex-direction: column; }
      .provider-cards { grid-template-columns: repeat(2, 1fr); }
      .modal-body { padding: 16px 18px; }
      .modal-header { padding: 18px 18px 0; }
      .modal-footer { padding: 12px 18px 18px; }
    }
  `]
})
export class LlmModelsComponent implements OnInit {

  readonly API = 'http://127.0.0.1:5000/api/llm_models/llm-models';

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
