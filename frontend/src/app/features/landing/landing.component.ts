import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
<!-- ═══════════════════════════════════════════════════
     NAVIGATION (LIGHT THEME)
═══════════════════════════════════════════════════ -->
<header class="nav-bar">
  <div class="nav-inner">
    <div class="nav-logo">
      <img src="assets/logo.png" alt="LEX-IA Logo" class="logo-img" />
      <span class="logo-text">LEX<span class="logo-ia">-IA</span></span>
    </div>
    <nav class="nav-links">
      <a href="#features">Fonctionnalités</a>
      <a href="#about">Pourquoi LEX-IA ?</a>
      <a href="#architecture">Architecture RAG</a>
      <a href="#roles">Accès Rôles</a>
      <a href="#faq">FAQ</a>
    </nav>
    
    <div class="nav-auth-box" *ngIf="auth.isLoggedIn(); else loginNav">
      <span class="user-pill-badge">👤 {{ getUserDisplayName() }}</span>
      <a routerLink="/dashboard" class="btn btn-primary btn-sm nav-cta">
        Tableau de bord
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>
    </div>

    <ng-template #loginNav>
      <a routerLink="/login" class="btn btn-navy btn-sm nav-cta">
        Se connecter
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>
    </ng-template>
  </div>
</header>

<!-- ═══════════════════════════════════════════════════
     HERO (LIGHT & ELEGANT WITH ORANGE ACCENTS)
═══════════════════════════════════════════════════ -->
<section class="hero bg-light-dots">
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>

  <div class="hero-container">
    <div class="hero-content">
      <span class="hero-badge animate-fadeIn">
        <span class="badge-dot"></span>
        Intelligence Artificielle Juridique pour Banques & Finance
      </span>
      <h1 class="hero-title animate-fadeInUp">
        La recherche juridique<br>
        <span class="text-gradient">réinventée pour le secteur bancaire</span>
      </h1>
      <p class="hero-subtitle animate-fadeInUp" style="animation-delay:.1s">
        LEX-IA simplifie l'analyse, l'indexation et l'interprétation des circulaires de Bank Al-Maghrib et des textes réglementaires marocains grâce à notre moteur RAG vectoriel hautement sécurisé.
      </p>
      <div class="hero-actions animate-fadeInUp" style="animation-delay:.2s">
        <a [routerLink]="auth.isLoggedIn() ? '/dashboard' : '/login'" class="btn btn-primary btn-lg">
          {{ auth.isLoggedIn() ? 'Accéder à mon Tableau de bord' : 'Accéder à la plateforme' }}
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
        <a href="#about" class="btn btn-outline btn-lg">
          Découvrir les fonctions
        </a>
      </div>

      <!-- Stats row -->
      <div class="hero-stats animate-fadeInUp" style="animation-delay:.3s">
        <div class="stat">
          <span class="stat-val text-navy">10 000+</span>
          <span class="stat-lbl">Documents réglementaires</span>
        </div>
        <div class="stat-div"></div>
        <div class="stat">
          <span class="stat-val text-navy">&lt; 1.5s</span>
          <span class="stat-lbl">Temps de réponse moyen</span>
        </div>
        <div class="stat-div"></div>
        <div class="stat">
          <span class="stat-val text-navy">Securisé</span>
          <span class="stat-lbl">Base vectorielle locale</span>
        </div>
      </div>
    </div>

    <!-- Hero visual featuring premium generated text-free image -->
    <div class="hero-visual animate-fadeIn" style="animation-delay:.15s">
      <div class="visual-wrapper glass glow-orange-border">
        <img src="assets/legal_ai_hero.png" alt="Intelligence Artificielle Juridique" class="hero-main-img" />
        <div class="floating-badge badge-tr font-serif">
          <span>⚖️ Conformité BAM</span>
        </div>
        <div class="floating-badge badge-bl">
          <span>🚀 RAG Performance</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════
     WHY LEX-IA / ABOUT SECTION
═══════════════════════════════════════════════════ -->
<section class="section about-section bg-light" id="about">
  <div class="container">
    <div class="about-grid">
      <div class="about-visual">
        <div class="about-img-wrapper glow-orange-border">
          <img src="assets/legal_docs_concept.png" alt="Analyse de documents juridiques" class="about-main-img" />
        </div>
      </div>
      <div class="about-content">
        <span class="section-tag">Pourquoi LEX-IA ?</span>
        <h2 class="about-title text-navy">Une solution sur-mesure pour les départements juridiques bancaires</h2>
        <p class="about-desc">
          Les banques et institutions financières font face à un flux constant de nouvelles directives, circulaires et réglementations de Bank Al-Maghrib. La recherche manuelle dans ces corpus denses est fastidieuse et expose à des risques de non-conformité.
        </p>
        <div class="benefit-list">
          <div class="benefit-item">
            <span class="benefit-icon">✔</span>
            <div>
              <strong>Précision sémantique :</strong> Notre système comprend l'intention derrière votre question légale grâce aux embeddings vectoriels multidimensionnels.
            </div>
          </div>
          <div class="benefit-item">
            <span class="benefit-icon">✔</span>
            <div>
              <strong>Intégrité & Sécurité :</strong> Fonctionne avec une base de données ChromaDB locale. Vos recherches stratégiques restent strictement confidentielles.
            </div>
          </div>
          <div class="benefit-item">
            <span class="benefit-icon">✔</span>
            <div>
              <strong>Rapports d'interprétation IA :</strong> Générez en un clic des synthèses conformes aux exigences de BAM, structurées pour la prise de décision.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════
     ARCHITECTURE & SECURITY SECTION (NEW VISUAL SHOWCASE)
═══════════════════════════════════════════════════ -->
<section class="section tech-section" id="architecture">
  <div class="container">
    <div class="about-grid reverse-grid">
      <div class="about-content">
        <span class="section-tag">Architecture & Sécurité</span>
        <h2 class="about-title text-navy">Indexation vectorielle et RAG 100% sur réseau local</h2>
        <p class="about-desc">
          Conçu selon les standards de sécurité bancaire les plus stricts, LEX-IA s'exécute sur votre infrastructure interne sans fuite de données vers des serveurs tiers.
        </p>
        <div class="tech-pills">
          <span class="tech-pill">⚡ Base Vectorielle ChromaDB</span>
          <span class="tech-pill">🔒 Réseau Local Sécurisé</span>
          <span class="tech-pill">🎯 Traçabilité des Sources</span>
          <span class="tech-pill">🤖 Synthèse LLM Personnalisée</span>
        </div>
      </div>
      <div class="about-visual">
        <div class="about-img-wrapper glow-orange-border">
          <img src="assets/vector_architecture.png" alt="Architecture Vectorielle ChromaDB" class="about-main-img" />
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════
     FEATURES
═══════════════════════════════════════════════════ -->
<section class="section features-section bg-light" id="features">
  <div class="container">
    <div class="section-header">
      <span class="section-tag">Fonctionnalités</span>
      <h2 class="section-title text-navy">Une suite d'outils performants<br>pour optimiser vos recherches</h2>
    </div>

    <div class="features-grid">
      <div class="feature-card card-hover animate-fadeInUp" *ngFor="let f of features; let i = index" [style.animation-delay]="i * 0.08 + 's'">
        <div class="feature-icon" [class]="'icon-' + f.color">
          <span [innerHTML]="f.icon"></span>
        </div>
        <h3 class="feature-title text-navy">{{ f.title }}</h3>
        <p class="feature-desc">{{ f.desc }}</p>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════
     ROLES SECTION
═══════════════════════════════════════════════════ -->
<section class="section roles-section" id="roles">
  <div class="container">
    <div class="section-header">
      <span class="section-tag">Gestion des accès</span>
      <h2 class="section-title text-navy">Une interface unifiée, des rôles adaptés</h2>
    </div>
    <div class="roles-grid">
      <div class="role-card" *ngFor="let r of roles">
        <div class="role-badge" [class]="'badge-' + r.color">{{ r.tag }}</div>
        <h3 class="text-navy">{{ r.name }}</h3>
        <p>{{ r.desc }}</p>
        <ul class="role-perms">
          <li *ngFor="let p of r.perms">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
            {{ p }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════
     FAQ SECTION (COLLAPSIBLE ACCORDION)
═══════════════════════════════════════════════════ -->
<section class="section faq-section bg-light" id="faq">
  <div class="container">
    <div class="section-header">
      <span class="section-tag">Des questions ?</span>
      <h2 class="section-title text-navy">Questions Fréquemment Posées</h2>
    </div>

    <div class="faq-accordion">
      <div class="faq-item card" *ngFor="let item of faqList; let idx = index" (click)="toggleFaq(idx)">
        <div class="faq-question flex-between">
          <h4 class="text-navy">{{ item.q }}</h4>
          <span class="faq-toggle">{{ openFaqIndex === idx ? '−' : '+' }}</span>
        </div>
        <div class="faq-answer" *ngIf="openFaqIndex === idx">
          <p>{{ item.a }}</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════
     CTA BANNER
═══════════════════════════════════════════════════ -->
<section class="cta-banner bg-light-gradient">
  <div class="orb orb-3"></div>
  <div class="cta-content">
    <h2 class="text-navy">Prenez de meilleures décisions réglementaires</h2>
    <p class="text-muted">Modernisez votre workflow juridique bancaire dès aujourd'hui avec LEX-IA.</p>
    <a [routerLink]="auth.isLoggedIn() ? '/dashboard' : '/login'" class="btn btn-primary btn-lg">
      {{ auth.isLoggedIn() ? 'Accéder à mon Tableau de bord' : 'Commencer maintenant' }}
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    </a>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════
     FOOTER (LIGHT THEME)
═══════════════════════════════════════════════════ -->
<footer class="footer">
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <img src="assets/logo.png" alt="LEX-IA Logo" class="logo-img" />
        <span class="logo-text text-navy">LEX<span class="logo-ia">-IA</span></span>
        <p class="text-muted">Recherche réglementaire intelligente pour les institutions financières.</p>
      </div>
      <div class="footer-links">
        <div class="footer-col">
          <div class="footer-col-title text-navy">Plateforme</div>
          <a href="#features">Fonctionnalités</a>
          <a href="#about">À propos</a>
          <a href="#architecture">Architecture</a>
        </div>
        <div class="footer-col">
          <div class="footer-col-title text-navy">Légal & Sécurité</div>
          <a href="#">Confidentialité</a>
          <a href="#">Conditions générales</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="text-muted">© 2026 LEX-IA. Tous droits réservés.</span>
      <span class="text-muted">Solution sur réseau local hautement sécurisée</span>
    </div>
  </div>
</footer>
  `,
  styles: [`
    /* NAVIGATION */
    .nav-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
    }
    .nav-inner {
      max-width: 1200px; margin: 0 auto; padding: 0 32px;
      height: 68px; display: flex; align-items: center; gap: 40px;
    }
    .nav-logo { display: flex; align-items: center; gap: 10px; }
    .logo-img { width: 38px; height: 38px; object-fit: contain; }
    .logo-text { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: var(--navy); }
    .logo-ia { color: #ff7a00; font-weight: 800; }
    .nav-links { display: flex; gap: 24px; margin-left: auto; }
    .nav-links a { color: var(--text-muted); font-size: 14px; font-weight: 500; transition: color .2s; }
    .nav-links a:hover { color: #ff7a00; }
    .nav-cta { margin-left: 8px; }
    .nav-auth-box { display: flex; align-items: center; gap: 12px; margin-left: auto; }
    .user-pill-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 14px; background: rgba(10, 31, 78, 0.06); border: 1px solid var(--border);
      border-radius: 99px; font-size: 13px; font-weight: 600; color: var(--navy);
    }

    .text-gradient {
      background: linear-gradient(135deg, var(--navy) 0%, #ff7a00 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* HERO */
    .hero {
      min-height: 100vh; padding: 120px 32px 80px;
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
      background-color: #fafbfc;
    }
    .bg-light-dots {
      background-image: radial-gradient(var(--border) 1px, transparent 1px);
      background-size: 24px 24px;
    }
    .hero-container {
      max-width: 1200px; width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 60px; flex-wrap: wrap;
    }
    .orb {
      position: absolute; border-radius: 50%;
      filter: blur(80px); pointer-events: none;
      z-index: 0;
    }
    .orb-1 { width: 400px; height: 400px; background: rgba(255, 122, 0, 0.08); top: -100px; right: -80px; }
    .orb-2 { width: 300px; height: 300px; background: rgba(10, 31, 78, 0.04); bottom: 0; left: -60px; }
    .orb-3 { width: 500px; height: 500px; background: rgba(255, 122, 0, 0.06); top: 50%; left: 50%; transform: translate(-50%, -50%); }

    .hero-content { flex: 1.2; min-width: 320px; max-width: 620px; z-index: 1; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(255, 122, 0, 0.08); border: 1px solid rgba(255, 122, 0, 0.25);
      color: #d96300; padding: 6px 14px; border-radius: 999px;
      font-size: 13px; font-weight: 600; margin-bottom: 24px;
    }
    .badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #ff7a00; animation: pulse-ring 2s infinite; }
    .hero-title { font-size: clamp(34px, 4.5vw, 54px); color: var(--navy); margin-bottom: 20px; font-weight: 700; font-family: 'Playfair Display', serif; }
    .hero-subtitle { font-size: 16px; color: var(--text-muted); line-height: 1.7; margin-bottom: 36px; }
    .hero-actions { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 48px; }
    .hero-stats { display: flex; align-items: center; gap: 24px; }
    .stat { display: flex; flex-direction: column; gap: 2px; }
    .stat-val { font-size: 24px; font-weight: 700; font-family: 'Playfair Display', serif; }
    .stat-lbl { font-size: 12px; color: var(--text-muted); }
    .stat-div { width: 1px; height: 40px; background: var(--border); }

    /* HERO VISUAL & GLOW BORDER */
    .hero-visual { flex: 0.8; min-width: 300px; max-width: 480px; z-index: 1; display: flex; justify-content: center; }
    .visual-wrapper {
      position: relative; border-radius: var(--radius-lg); padding: 12px;
      background: #ffffff; border: 1px solid var(--border);
      box-shadow: 0 16px 40px rgba(10,31,78,0.12); transition: transform 0.3s;
    }
    .glow-orange-border {
      border-color: rgba(255, 122, 0, 0.3) !important;
      box-shadow: 0 12px 36px rgba(255, 122, 0, 0.12) !important;
    }
    .visual-wrapper:hover { transform: translateY(-5px); }
    .hero-main-img { width: 100%; height: auto; border-radius: var(--radius); object-fit: cover; display: block; }
    .floating-badge {
      position: absolute; background: #ffffff; border: 1px solid var(--border);
      box-shadow: var(--shadow); border-radius: 99px; padding: 6px 14px;
      font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;
    }
    .badge-tr { top: 20px; right: -15px; color: var(--navy); }
    .badge-bl { bottom: 20px; left: -15px; color: #ff7a00; }

    /* WHY LEX-IA / ABOUT SECTION */
    .bg-light { background-color: #f8fafc; }
    .about-grid { display: grid; grid-template-columns: 1fr 1.1fr; gap: 60px; align-items: center; }
    .reverse-grid { grid-template-columns: 1.1fr 1fr; }
    @media (max-width: 768px) { .about-grid { grid-template-columns: 1fr; gap: 40px; } }
    .about-img-wrapper {
      background: #ffffff; border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 12px; box-shadow: var(--shadow);
    }
    .about-main-img { width: 100%; border-radius: var(--radius); height: auto; display: block; }
    .about-title { font-size: clamp(26px, 3.5vw, 36px); margin-bottom: 20px; font-weight: 600; font-family: 'Playfair Display', serif; }
    .about-desc { font-size: 15px; color: var(--text-muted); line-height: 1.7; margin-bottom: 24px; }
    .benefit-list { display: flex; flex-direction: column; gap: 16px; }
    .benefit-item { display: flex; align-items: flex-start; gap: 12px; font-size: 14px; color: var(--text); }
    .benefit-icon {
      width: 22px; height: 22px; border-radius: 50%; background: rgba(255, 122, 0, 0.12);
      color: #ff7a00; display: flex; align-items: center; justify-content: center;
      font-size: 11px; flex-shrink: 0; font-weight: bold; margin-top: 2px;
    }

    /* TECH PILLS */
    .tech-pills { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
    .tech-pill {
      padding: 6px 14px; background: rgba(255, 122, 0, 0.08); border: 1px solid rgba(255, 122, 0, 0.2);
      color: #d96300; border-radius: 99px; font-size: 12.5px; font-weight: 600;
    }

    /* SECTION LAYOUT */
    .section { padding: 96px 32px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .section-header { text-align: center; margin-bottom: 64px; }
    .section-tag {
      display: inline-block; background: rgba(255, 122, 0, 0.08); color: #ff7a00;
      border-radius: 999px; padding: 5px 16px; font-size: 13px; font-weight: 600;
      margin-bottom: 16px; letter-spacing: .5px;
    }
    .section-title { font-size: clamp(28px, 4vw, 38px); font-family: 'Playfair Display', serif; }

    /* FEATURES */
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; }
    .feature-card { padding: 32px; background: #ffffff; border-radius: 16px; border: 1px solid var(--border); }
    .feature-icon {
      width: 52px; height: 52px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; margin-bottom: 20px;
    }
    .icon-teal { background: rgba(255, 122, 0, 0.1); }
    .icon-navy { background: rgba(10, 31, 78, 0.06); }
    .icon-purple { background: rgba(255, 122, 0, 0.08); }
    .icon-amber { background: rgba(245, 158, 11, 0.08); }
    .icon-rose { background: rgba(244, 63, 94, 0.08); }
    .icon-green { background: rgba(16, 185, 129, 0.08); }
    .feature-title { font-size: 18px; margin-bottom: 10px; font-family: 'Playfair Display', serif; }
    .feature-desc { font-size: 14px; color: var(--text-muted); line-height: 1.7; }

    /* ROLES */
    .roles-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
    .role-card {
      background: #ffffff; border-radius: 16px; padding: 28px;
      border: 1px solid var(--border); transition: all .2s;
    }
    .role-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-3px); border-color: rgba(255, 122, 0, 0.3); }
    .role-badge { display: inline-block; border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
    .badge-navy-role { background: rgba(10, 31, 78, 0.08); color: var(--navy); }
    .badge-teal-role { background: rgba(255, 122, 0, 0.12); color: #d96300; }
    .badge-blue-role { background: rgba(59, 130, 246, 0.08); color: #1d4ed8; }
    .role-card h3 { font-size: 19px; margin-bottom: 8px; font-family: 'Playfair Display', serif; }
    .role-card p { font-size: 14px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.6; }
    .role-perms { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .role-perms li { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); }
    .role-perms svg { color: #ff7a00; flex-shrink: 0; }

    /* FAQ ACCORDION */
    .faq-accordion { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
    .faq-item { padding: 20px 24px; border-radius: 14px; border: 1px solid var(--border); background: #ffffff; cursor: pointer; transition: var(--transition); }
    .faq-item:hover { border-color: rgba(255, 122, 0, 0.3); }
    .faq-question h4 { font-size: 15.5px; font-weight: 700; margin: 0; }
    .faq-toggle { font-size: 20px; font-weight: 700; color: #ff7a00; }
    .faq-answer { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-light); font-size: 14px; color: var(--text-muted); line-height: 1.6; }

    /* CTA BANNER */
    .cta-banner {
      padding: 96px 32px; text-align: center;
      position: relative; overflow: hidden;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }
    .bg-light-gradient {
      background: linear-gradient(135deg, #f8fafc 0%, #fff7ed 100%);
    }
    .cta-content { position: relative; z-index: 1; }
    .cta-content h2 { font-size: clamp(26px, 3.5vw, 40px); margin-bottom: 16px; font-weight: 600; font-family: 'Playfair Display', serif; }
    .cta-content p { font-size: 16px; margin-bottom: 32px; }

    /* FOOTER */
    .footer { background: #ffffff; padding: 60px 32px 24px; border-top: 1px solid var(--border); }
    .footer-top { display: flex; justify-content: space-between; gap: 40px; flex-wrap: wrap; margin-bottom: 40px; }
    .footer-brand { display: flex; flex-direction: column; gap: 12px; max-width: 260px; }
    .footer-brand p { font-size: 13px; line-height: 1.6; margin-top: 4px; }
    .footer-links { display: flex; gap: 60px; }
    .footer-col { display: flex; flex-direction: column; gap: 10px; }
    .footer-col-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .footer-col a { font-size: 14px; color: var(--text-muted); transition: color .2s; }
    .footer-col a:hover { color: #ff7a00; }
    .footer-bottom { border-top: 1px solid var(--border-light); padding-top: 24px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .footer-bottom span { font-size: 13px; }
  `]
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
