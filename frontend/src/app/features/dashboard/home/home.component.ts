import { Component, computed, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Chart } from 'chart.js/auto';
import type { TooltipItem } from 'chart.js';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

interface StatItem {
  icon: string;
  color: string;
  value: string;
  label: string;
  trend: number;
}

interface ActivityItem {
  type: string;
  title: string;
  time: string;
}

/** Bloc de donnees renvoye par /api/dashboard/charts */
interface SerieChart {
  labels: string[];
  data: number[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {

  private readonly API = `${environment.apiUrl}/api/dashboard`;

  // Palette alignee sur la charte LEX-IA
  private readonly ORANGE = '#ff7a00';
  private readonly NAVY = '#0a1f4e';
  private readonly TEAL = '#14b8a6';
  private readonly AMBER = '#f59e0b';

  /** UI state **/
  isLoading = true;
  statsError = false;
  chartsError = false;

  @ViewChild('evolutionCanvas') evolutionCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('statutCanvas') statutCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('utilisateursCanvas') utilisateursCanvas?: ElementRef<HTMLCanvasElement>;

  private evolutionChart?: Chart;
  private statutChart?: Chart;
  private utilisateursChart?: Chart;

  /** Periodes proposees pour la courbe d'evolution (en jours) */
  periodes = [7, 30, 90];
  periodeActive = 30;

  totalQuestions = 0;
  chartsVides = false;

  firstName = computed(() => {
    const u = this.auth.currentUser();
    return u?.firstname ?? u?.username ?? 'Utilisateur';
  });

  isJuriste = computed(() => this.auth.getRoleName() === 'Responsable juridique');

  /** Stats for default (admin / user) dashboard */
  stats: StatItem[] = [
    { icon: '🔍', color: 'teal',   value: '0',    label: 'Recherches enregistrées', trend: 0 },
    { icon: '📄', color: 'navy',   value: '0',    label: 'Documents indexés',        trend: 5 },
    { icon: '⚖️', color: 'amber',  value: '0',    label: 'Jurisprudences publiées',  trend: 0 },
    { icon: '🧠', color: 'purple', value: '98.5%', label: 'Précision sémantique',   trend: 2 },
  ];

  /** Stats for Responsable Juridique dashboard */
  juristeStats: StatItem[] = [
    { icon: '⚖️', color: 'orange', value: '0', label: 'Jurisprudences publiées',    trend: 0 },
    { icon: '🔍', color: 'teal',   value: '0', label: 'Recherches effectuées',       trend: 0 },
    { icon: '📜', color: 'navy',   value: '0', label: 'Documents consultés',         trend: 0 },
    { icon: '✅', color: 'amber',  value: '0', label: 'Validations réalisées',       trend: 2 },
  ];

  recentActivity: ActivityItem[] = [];

  quickActions = computed(() => {
    const role = this.auth.getRoleName();
    const base = [
      { icon: '🔍', color: 'teal',   title: 'Recherche sémantique', desc: 'Interrogez la base légale',    path: '/dashboard/search' },
      { icon: '👤', color: 'navy',   title: 'Mon profil',           desc: 'Gérez vos informations',       path: '/dashboard/profile' },
    ];
    if (role === 'Administrateur') {
      base.splice(1, 0, { icon: '⚖️', color: 'purple', title: 'Jurisprudence',  desc: 'Gérez les réponses juridiques', path: '/dashboard/jurisprudence' });
      base.push({ icon: '👥', color: 'amber', title: 'Utilisateurs', desc: 'Administrez les comptes', path: '/dashboard/users' });
    }
    return base;
  });

  constructor(private auth: AuthService, private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadStats();
  }

  ngAfterViewInit() {
    // Canvas elements are ready — charts can now render.
    this.loadCharts();
  }

  ngOnDestroy() {
    this.evolutionChart?.destroy();
    this.statutChart?.destroy();
    this.utilisateursChart?.destroy();
  }

  changerPeriode(jours: number) {
    if (jours === this.periodeActive) { return; }
    this.periodeActive = jours;
    this.cdr.markForCheck();
    this.loadCharts();
  }

  loadStats() {
    this.isLoading = true;
    this.statsError = false;
    this.http.get<any>(`${this.API}/stats`).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.questions) {
          this.stats[0].value = String(res.questions.total || 0);
          this.juristeStats[1].value = String(res.questions.total || 0);
        }
        if (res.documents) {
          this.stats[1].value = String(res.documents.total || 0);
          this.juristeStats[2].value = String(res.documents.total || 0);
        }
        if (res.jurisprudences) {
          this.stats[2].value = String(res.jurisprudences.total || 0);
          this.juristeStats[0].value = String(res.jurisprudences.total || 0);
        }
        if (res.recent_activity) {
          this.recentActivity = res.recent_activity;
        }
        this.cdr.markForCheck(); // notify OnPush that view needs update
      },
      error: (err) => {
        this.isLoading = false;
        this.statsError = true;
        console.error('[Dashboard] Stats API error:', err);
        this.cdr.markForCheck();
      }
    });
  }

  // ─────────────────────────────────────────────────
  // Graphiques
  // ─────────────────────────────────────────────────

  loadCharts() {
    this.chartsError = false;
    this.http.get<any>(`${this.API}/charts?jours=${this.periodeActive}&top=5`).subscribe({
      next: (res) => {
        this.chartsError = false;
        this.dessinerEvolution(res.questions_par_jour);
        this.dessinerStatut(res.questions_par_statut);
        this.dessinerUtilisateurs(res.top_utilisateurs);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.chartsVides = true;
        this.chartsError = true;
        console.error('[Dashboard] Charts API error:', err);
        this.cdr.markForCheck();
      }
    });
  }

  private dessinerEvolution(serie: SerieChart) {
    const canvas = this.evolutionCanvas?.nativeElement;
    if (!canvas || !serie) { return; }

    this.chartsVides = serie.data.every(v => v === 0);
    this.evolutionChart?.destroy();

    // Degrade vertical sous la courbe
    const ctx = canvas.getContext('2d');
    let fond: string | CanvasGradient = 'rgba(255,122,0,.12)';
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 280);
      gradient.addColorStop(0, 'rgba(255,122,0,.28)');
      gradient.addColorStop(1, 'rgba(255,122,0,.01)');
      fond = gradient;
    }

    this.evolutionChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: serie.labels,
        datasets: [{
          label: 'Recherches',
          data: serie.data,
          borderColor: this.ORANGE,
          backgroundColor: fond,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: this.ORANGE,
          tension: 0.35,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: this.NAVY,
            padding: 10,
            displayColors: false,
            callbacks: {
              label: (item: TooltipItem<'line'>) => `${item.parsed.y} recherche(s)`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#7b8794',
              font: { size: 11 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(10,31,78,.06)' },
            ticks: { color: '#7b8794', font: { size: 11 }, precision: 0 }
          }
        }
      }
    });
  }

  private dessinerStatut(serie: SerieChart) {
    const canvas = this.statutCanvas?.nativeElement;
    if (!canvas || !serie) { return; }

    this.totalQuestions = serie.data.reduce((a, b) => a + b, 0);
    this.statutChart?.destroy();

    this.statutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: serie.labels,
        datasets: [{
          data: serie.data,
          backgroundColor: [this.ORANGE, this.NAVY, this.TEAL],
          borderColor: '#fff',
          borderWidth: 3,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16,
              color: '#48566b',
              font: { size: 12 }
            }
          },
          tooltip: {
            backgroundColor: this.NAVY,
            padding: 10,
            callbacks: {
              label: (item: TooltipItem<'doughnut'>) => {
                const valeur = item.parsed as number;
                const pct = this.totalQuestions
                  ? Math.round((valeur / this.totalQuestions) * 100)
                  : 0;
                return ` ${item.label} : ${valeur} (${pct} %)`;
              }
            }
          }
        }
      }
    });
  }

  private dessinerUtilisateurs(serie: SerieChart) {
    const canvas = this.utilisateursCanvas?.nativeElement;
    if (!canvas || !serie) { return; }

    this.utilisateursChart?.destroy();

    // Les libelles sont des adresses e-mail : on tronque pour rester lisible.
    const labels = serie.labels.map(l => l.length > 22 ? l.slice(0, 20) + '…' : l);

    this.utilisateursChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Recherches',
          data: serie.data,
          backgroundColor: this.NAVY,
          hoverBackgroundColor: this.ORANGE,
          borderRadius: 6,
          barThickness: 18,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: this.NAVY,
            padding: 10,
            displayColors: false,
            // Le libelle tronque est remplace par sa version complete
            callbacks: {
              title: (items: TooltipItem<'bar'>[]) => serie.labels[items[0].dataIndex],
              label: (item: TooltipItem<'bar'>) => `${item.parsed.x} recherche(s)`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(10,31,78,.06)' },
            ticks: { color: '#7b8794', font: { size: 11 }, precision: 0 }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#48566b', font: { size: 11 } }
          }
        }
      }
    });
  }
}
