import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit, OnDestroy {
  typingText = '';
  cursorBlink = true;
  openFaqIndex: number | null = null;
  private typingInterval: any;
  private cursorInterval: any;
  private fullText = 'Quelle est la réglementation sur les fonds propres?';

  features = [
    { icon: '🔍', color: 'teal', title: 'Recherche sémantique', desc: 'Trouvez les textes pertinents en langage naturel grâce à l\'IA vectorielle ChromaDB.' },
    { icon: '⚖️', color: 'navy', title: 'Base légale marocaine', desc: 'Corpus complet : circulaires BAM, loi bancaire 103-12 et textes réglementaires.' },
    { icon: '🧠', color: 'purple', title: 'Interprétation LLM', desc: 'Génération automatique d\'analyses juridiques fondées sur les textes exacts.' },
    { icon: '📚', color: 'amber', title: 'Jurisprudence', desc: 'Enrichissement collaboratif par les responsables juridiques de l\'établissement.' },
    { icon: '🛡️', color: 'rose', title: 'Réseau local sécurisé', desc: 'Sphaère locale étanche, authentification JWT et rôles granulaires.' },
    { icon: '📊', color: 'green', title: 'Tableau de bord', desc: 'Statistiques d\'utilisation, suivi des recherches et gestion des groupes.' },
  ];

  roles = [
    {
      tag: 'Admin', color: 'navy-role', name: 'Administrateur',
      desc: 'Gestion complète de la plateforme, des utilisateurs et de l\'indexation.',
      perms: ['Gestion des utilisateurs', 'Configuration système', 'Accès toutes fonctions']
    },
    {
      tag: 'Juridique', color: 'teal-role', name: 'Responsable Juridique',
      desc: 'Validation et publication des réponses de jurisprudence et rapports IA.',
      perms: ['Recherche sémantique', 'Créer jurisprudence', 'Publier des réponses']
    },
    {
      tag: 'Utilisateur', color: 'blue-role', name: 'Utilisateur',
      desc: 'Accès à la recherche juridique et consultation des résultats.',
      perms: ['Recherche sémantique', 'Consultation résultats', 'Profil personnel']
    },
  ];

  faqList = [
    {
      q: 'Comment LEX-IA garantit-il la sécurité des données bancaires ?',
      a: 'LEX-IA fonctionne entièrement sur votre réseau local (On-Premise). Les recherches vectorielles ChromaDB et la génération des rapports s\'exécutent sans transmettre aucune donnée vers l\'extérieur.'
    },
    {
      q: 'Quels textes légaux sont actuellement indexés ?',
      a: 'Le système contient les circulaires et directives de Bank Al-Maghrib, la loi bancaire n° 103-12, ainsi que le Code de Commerce et les textes réglementaires associés.'
    },
    {
      q: 'Comment s\'effectue la recherche par pertinence sémantique ?',
      a: 'Au lieu de simples mots-clés, LEX-IA transforme votre question en un vecteur multidimensionnel et recherche dans ChromaDB les paragraphes légaux qui partagent la même intention juridique.'
    },
    {
      q: 'Peut-on exporter des rapports d\'analyse juridique ?',
      a: 'Oui ! Vous pouvez sélectionner des articles et générer en un clic un rapport d\'analyse juridique structuré conforme aux exigences de BAM.'
    }
  ];

  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  getUserDisplayName(): string {
    const u: any = this.auth.currentUser();
    if (!u) return 'Utilisateur';
    if (u.firstname) return `${u.firstname} ${u.lastname || ''}`.trim();
    return u.username || u.sub || u.name || 'Utilisateur';
  }

  toggleFaq(idx: number) {
    this.openFaqIndex = this.openFaqIndex === idx ? null : idx;
  }

  ngOnInit() {
    let i = 0;
    this.typingInterval = setInterval(() => {
      if (i <= this.fullText.length) {
        this.typingText = this.fullText.substring(0, i++);
      } else {
        clearInterval(this.typingInterval);
      }
    }, 55);
    this.cursorInterval = setInterval(() => this.cursorBlink = !this.cursorBlink, 530);
  }

  ngOnDestroy() {
    clearInterval(this.typingInterval);
    clearInterval(this.cursorInterval);
  }
}
