<script lang="ts">
	import { goto } from '$app/navigation';
	import { isAuthenticated, user } from '$lib/stores/auth';
	import { browser } from '$app/environment';

	let { data } = $props();

	// On admin/demo domains, keep original redirect behavior
	$effect(() => {
		if (!data.isLandingDomain && browser) {
			if ($isAuthenticated && $user) {
				goto($user.role === 'admin' ? '/admin' : '/view', { replaceState: true });
			} else {
				goto('/login', { replaceState: true });
			}
		}
	});

	// Scroll-based fade-in animation
	let sections: HTMLElement[] = $state([]);

	$effect(() => {
		if (!browser || !data.isLandingDomain) return;
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add('visible');
					}
				});
			},
			{ threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
		);
		sections.forEach((el) => el && observer.observe(el));
		return () => observer.disconnect();
	});

	function addSection(el: HTMLElement) {
		sections = [...sections, el];
	}

	const loginUrl = '/login';
</script>

<svelte:head>
	{#if data.isLandingDomain}
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
		<link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
		<title>Lemon Lab — Simulateurs SaaS par Lemon Learning</title>
		<meta name="description" content="Créez des environnements SaaS interactifs pour former, évaluer et accompagner vos équipes. Par Lemon Learning." />
		<meta property="og:title" content="Lemon Lab — Simulateurs SaaS" />
		<meta property="og:description" content="Capturez, personnalisez et partagez des simulations réalistes de vos outils métier." />
		<meta property="og:type" content="website" />
		<meta property="og:url" content="https://getlemonlab.com" />
	{:else}
		<title>Lemon Lab — Lemon Learning</title>
	{/if}
</svelte:head>

{#if !data.isLandingDomain}
	<div class="flex min-h-screen items-center justify-center bg-background">
		<div class="flex items-center gap-3">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
			<span class="text-sm text-muted-foreground">Redirection...</span>
		</div>
	</div>
{:else}
	<div class="landing">

		<!-- ════ NAVBAR ════ -->
		<nav class="navbar">
			<div class="nav-inner">
				<div class="nav-brand">
					<div class="nav-logo">
						<svg width="22" height="22" viewBox="0 0 32 32" fill="none">
							<path d="M12 4 L12 13 L6 25 Q5 27 7 28 L25 28 Q27 27 26 25 L20 13 L20 4" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
							<line x1="10" y1="4" x2="22" y2="4" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
							<path d="M8.5 21 L12.5 14 L19.5 14 L23.5 21 Q25 24 24 26 Q23 27 22 27 L10 27 Q9 27 8 26 Q7 24 8.5 21Z" fill="rgba(255,255,255,0.2)"/>
							<circle cx="14" cy="22" r="1.8" fill="#FAE100"/>
							<circle cx="18.5" cy="19" r="1.3" fill="rgba(255,255,255,0.5)"/>
						</svg>
					</div>
					<span class="nav-name">Lemon Lab</span>
					<span class="nav-by">by Lemon Learning</span>
				</div>
				<div class="nav-links">
					<a href="#features" class="nav-link">Fonctionnalités</a>
					<a href="#how" class="nav-link">Comment ça marche</a>
					<a href="#usecases" class="nav-link">Cas d'usage</a>
					<a href={loginUrl} class="nav-cta">Se connecter</a>
				</div>
				<a href={loginUrl} class="nav-cta-mobile">Connexion</a>
			</div>
		</nav>

		<!-- ════ HERO ════ -->
		<section class="hero">
			<div class="hero-bg"></div>
			<div class="hero-dots"></div>
			<div class="hero-shape"></div>
			<div class="hero-content" use:addSection>
				<div class="hero-badge">
					<span class="badge-dot"></span>
					Nouveau — Export SCORM, HTML & PowerPoint
				</div>
				<h1 class="hero-title">
					Créez des simulateurs<br/>
					<span class="hero-gradient">SaaS interactifs</span><br/>
					en quelques clics
				</h1>
				<p class="hero-sub">
					Capturez n'importe quelle application métier, personnalisez les données,
					et générez des parcours de formation immersifs — sans écrire une ligne de code.
				</p>
				<div class="hero-actions">
					<a href={loginUrl} class="btn-hero">
						Accéder à la plateforme
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
					</a>
					<a href="#features" class="btn-hero-secondary">Découvrir les fonctionnalités</a>
				</div>
				<div class="hero-stats">
					<div class="stat">
						<span class="stat-value">300+</span>
						<span class="stat-label">Applications supportées</span>
					</div>
					<div class="stat-divider"></div>
					<div class="stat">
						<span class="stat-value">-50%</span>
						<span class="stat-label">Coût de formation</span>
					</div>
					<div class="stat-divider"></div>
					<div class="stat">
						<span class="stat-value">0</span>
						<span class="stat-label">Ligne de code requise</span>
					</div>
				</div>
			</div>
		</section>

		<!-- ════ LOGOS ════ -->
		<section class="logos" use:addSection>
			<p class="logos-label">Compatible avec vos applications métier</p>
			<div class="logos-strip">
				{#each ['Salesforce', 'SAP', 'Workday', 'Oracle', 'ServiceNow', 'Microsoft 365', 'HubSpot', 'Jira'] as name}
					<span class="logo-pill">{name}</span>
				{/each}
			</div>
		</section>

		<!-- ════ FEATURES ════ -->
		<section id="features" class="features" use:addSection>
			<div class="section-header">
				<span class="section-tag">Fonctionnalités</span>
				<h2 class="section-title">Tout ce qu'il faut pour simuler, former et évaluer</h2>
				<p class="section-sub">De la capture à l'évaluation, une suite complète pour créer des environnements de formation réalistes.</p>
			</div>
			<div class="features-grid">
				<div class="feature-card">
					<div class="feature-icon icon-capture">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
					</div>
					<h3 class="feature-title">Capture intelligente</h3>
					<p class="feature-desc">Extension Chrome pour capturer n'importe quelle page SaaS en un clic. Gestion automatique des états, modales et transitions.</p>
				</div>
				<div class="feature-card">
					<div class="feature-icon icon-shield">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
					</div>
					<h3 class="feature-title">Obfuscation des données</h3>
					<p class="feature-desc">Masquage automatique des données sensibles. Remplacez noms, montants et identifiants par des données fictives réalistes.</p>
				</div>
				<div class="feature-card">
					<div class="feature-icon icon-share">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
					</div>
					<h3 class="feature-title">Export multi-format</h3>
					<p class="feature-desc">Exportez vos simulations en SCORM (toutes versions), HTML autonome, PowerPoint ou PDF. Compatible avec tous les LMS.</p>
				</div>
				<div class="feature-card">
					<div class="feature-icon icon-guide">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
					</div>
					<h3 class="feature-title">Guides & parcours</h3>
					<p class="feature-desc">Organisez vos simulations en guides de formation avec des pages d'introduction, des étapes interactives et du contenu e-learning.</p>
				</div>
				<div class="feature-card">
					<div class="feature-icon icon-check">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
					</div>
					<h3 class="feature-title">Mode évaluation</h3>
					<p class="feature-desc">Testez les connaissances avec des quiz, questionnaires et validations intégrées. Bouton indice optionnel pour guider l'apprenant.</p>
				</div>
				<div class="feature-card">
					<div class="feature-icon icon-chart">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
					</div>
					<h3 class="feature-title">Analytics & suivi</h3>
					<p class="feature-desc">Suivez la progression en temps réel. Logs détaillés, taux de complétion, notes de satisfaction et rapports d'activité.</p>
				</div>
			</div>
		</section>

		<!-- ════ HOW IT WORKS ════ -->
		<section id="how" class="how" use:addSection>
			<div class="section-header">
				<span class="section-tag">Comment ça marche</span>
				<h2 class="section-title">De la capture au partage en 3 étapes</h2>
			</div>
			<div class="steps">
				<div class="step">
					<div class="step-number">1</div>
					<div class="step-content">
						<h3 class="step-title">Installez l'extension</h3>
						<p class="step-desc">Disponible sur le Chrome Web Store. Un clic pour l'ajouter à votre navigateur.</p>
					</div>
				</div>
				<div class="step-connector"></div>
				<div class="step">
					<div class="step-number">2</div>
					<div class="step-content">
						<h3 class="step-title">Capturez vos pages</h3>
						<p class="step-desc">Naviguez dans votre application et capturez chaque écran. L'extension gère les états, modales et transitions.</p>
					</div>
				</div>
				<div class="step-connector"></div>
				<div class="step">
					<div class="step-number">3</div>
					<div class="step-content">
						<h3 class="step-title">Partagez & formez</h3>
						<p class="step-desc">Créez des guides, ajoutez des quiz, exportez en SCORM et partagez avec vos équipes via un lien unique.</p>
					</div>
				</div>
			</div>
		</section>

		<!-- ════ USE CASES ════ -->
		<section id="usecases" class="usecases" use:addSection>
			<div class="section-header">
				<span class="section-tag">Cas d'usage</span>
				<h2 class="section-title">Adapté à chaque besoin de formation</h2>
			</div>
			<div class="usecases-grid">
				<div class="usecase-card">
					<div class="usecase-emoji">🎓</div>
					<h3 class="usecase-title">Formation logicielle</h3>
					<p class="usecase-desc">Créez des parcours immersifs qui reproduisent fidèlement l'environnement de travail réel. Vos collaborateurs s'entraînent sans risque sur une copie exacte de leurs outils.</p>
				</div>
				<div class="usecase-card">
					<div class="usecase-emoji">✅</div>
					<h3 class="usecase-title">Évaluation des compétences</h3>
					<p class="usecase-desc">Validez la maîtrise des outils avec le mode test. Questionnaires, quiz et notation intégrés pour mesurer la progression de chaque apprenant.</p>
				</div>
				<div class="usecase-card">
					<div class="usecase-emoji">🚀</div>
					<h3 class="usecase-title">Onboarding</h3>
					<p class="usecase-desc">Accélérez l'intégration de vos nouveaux collaborateurs. Des guides interactifs étape par étape pour une prise en main rapide et autonome.</p>
				</div>
			</div>
		</section>

		<!-- ════ CTA BANNER ════ -->
		<section class="cta-banner" use:addSection>
			<div class="cta-inner">
				<h2 class="cta-title">Prêt à créer votre premier simulateur ?</h2>
				<p class="cta-sub">Rejoignez les entreprises qui forment mieux avec Lemon Lab.</p>
				<a href={loginUrl} class="btn-cta">
					Commencer maintenant
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
				</a>
			</div>
		</section>

		<!-- ════ FOOTER ════ -->
		<footer class="footer">
			<div class="footer-inner">
				<div class="footer-brand">
					<div class="footer-logo">
						<svg width="18" height="18" viewBox="0 0 32 32" fill="none">
							<path d="M12 4 L12 13 L6 25 Q5 27 7 28 L25 28 Q27 27 26 25 L20 13 L20 4" stroke="#2B72EE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
							<line x1="10" y1="4" x2="22" y2="4" stroke="#2B72EE" stroke-width="2.5" stroke-linecap="round"/>
							<circle cx="14" cy="22" r="1.8" fill="#FAE100"/>
							<circle cx="18.5" cy="19" r="1.3" fill="#2B72EE" opacity="0.3"/>
						</svg>
						<span>Lemon Lab</span>
					</div>
					<p class="footer-tagline">Simulateurs SaaS interactifs par Lemon Learning</p>
				</div>
				<div class="footer-links">
					<a href="/login">Se connecter</a>
					<a href="#features">Fonctionnalités</a>
					<a href="#usecases">Cas d'usage</a>
				</div>
				<div class="footer-legal">
					<p>Lemon Learning — 89 Boulevard de Sébastopol, 75002 Paris, France</p>
					<p class="footer-copy">&copy; 2026 Lemon Learning. Tous droits réservés. — <a href="/mentions-legales">Mentions légales</a> · <a href="/confidentialite">Politique de confidentialité</a> · <a href="/cgu">CGU</a></p>
				</div>
			</div>
		</footer>
	</div>
{/if}

<style>
	/* ── GLOBALS ── */
	.landing {
		--blue: #2B72EE;
		--blue-hover: #245FC6;
		--blue-light: rgba(43, 114, 238, 0.08);
		--yellow: #FAE100;
		--text: #242F42;
		--text-secondary: #6D7481;
		--text-muted: #9197A0;
		--bg: #FFFFFF;
		--bg-alt: #F7F7F8;
		--border: #E2E3E6;
		font-family: 'Albert Sans', system-ui, sans-serif;
		color: var(--text);
		overflow-x: hidden;
	}

	/* Fade-in animation */
	:global(.landing section > div),
	:global(.landing .hero-content),
	:global(.landing .logos) {
		opacity: 0;
		transform: translateY(24px);
		transition: opacity 0.7s ease, transform 0.7s ease;
	}
	:global(.landing .visible),
	:global(.landing .visible > div) {
		opacity: 1 !important;
		transform: translateY(0) !important;
	}

	/* ── NAVBAR ── */
	.navbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--border);
	}
	.nav-inner {
		max-width: 1120px;
		margin: 0 auto;
		padding: 0 24px;
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.nav-brand {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.nav-logo {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: linear-gradient(135deg, #2B72EE 0%, #1D4C9F 100%);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.nav-name {
		font-size: 17px;
		font-weight: 700;
		letter-spacing: -0.3px;
	}
	.nav-by {
		font-size: 12px;
		color: var(--text-muted);
		margin-left: -4px;
	}
	.nav-links {
		display: flex;
		align-items: center;
		gap: 28px;
	}
	.nav-link {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-secondary);
		text-decoration: none;
		transition: color 0.2s;
	}
	.nav-link:hover { color: var(--text); }
	.nav-cta {
		font-size: 14px;
		font-weight: 600;
		color: white;
		background: var(--blue);
		padding: 8px 20px;
		border-radius: 8px;
		text-decoration: none;
		transition: all 0.2s;
	}
	.nav-cta:hover {
		background: var(--blue-hover);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(43, 114, 238, 0.3);
	}
	.nav-cta-mobile {
		display: none;
		font-size: 13px;
		font-weight: 600;
		color: white;
		background: var(--blue);
		padding: 7px 16px;
		border-radius: 8px;
		text-decoration: none;
	}

	/* ── HERO ── */
	.hero {
		position: relative;
		padding: 140px 24px 80px;
		text-align: center;
		overflow: hidden;
	}
	.hero-bg {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at 30% 20%, rgba(43, 114, 238, 0.06) 0%, transparent 50%),
					radial-gradient(ellipse at 70% 80%, rgba(43, 114, 238, 0.04) 0%, transparent 50%);
	}
	.hero-dots {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle, rgba(43, 114, 238, 0.06) 1px, transparent 1px);
		background-size: 28px 28px;
	}
	.hero-shape {
		position: absolute;
		width: 600px;
		height: 600px;
		top: -200px;
		right: -100px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(43, 114, 238, 0.08) 0%, transparent 70%);
		filter: blur(60px);
		animation: float 20s ease-in-out infinite;
	}
	@keyframes float {
		0%, 100% { transform: translate(0, 0); }
		50% { transform: translate(-30px, 20px); }
	}
	.hero-content {
		position: relative;
		max-width: 720px;
		margin: 0 auto;
	}
	.hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 500;
		color: var(--blue);
		background: var(--blue-light);
		border: 1px solid rgba(43, 114, 238, 0.15);
		padding: 6px 16px;
		border-radius: 20px;
		margin-bottom: 28px;
	}
	.badge-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--blue);
		animation: pulse 2s infinite;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}
	.hero-title {
		font-size: 52px;
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: -1.5px;
		margin-bottom: 20px;
	}
	.hero-gradient {
		background: linear-gradient(135deg, #2B72EE, #6D5BF7);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
	.hero-sub {
		font-size: 18px;
		line-height: 1.6;
		color: var(--text-secondary);
		max-width: 560px;
		margin: 0 auto 36px;
	}
	.hero-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		margin-bottom: 56px;
	}
	.btn-hero {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 14px 28px;
		background: var(--blue);
		color: white;
		font-size: 15px;
		font-weight: 600;
		font-family: inherit;
		border-radius: 10px;
		text-decoration: none;
		transition: all 0.2s;
	}
	.btn-hero:hover {
		background: var(--blue-hover);
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(43, 114, 238, 0.3);
	}
	.btn-hero-secondary {
		padding: 14px 28px;
		border: 1px solid var(--border);
		color: var(--text);
		font-size: 15px;
		font-weight: 500;
		font-family: inherit;
		border-radius: 10px;
		text-decoration: none;
		transition: all 0.2s;
		background: white;
	}
	.btn-hero-secondary:hover {
		border-color: #d1d5db;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
	}
	.hero-stats {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 32px;
	}
	.stat { text-align: center; }
	.stat-value {
		display: block;
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.5px;
		color: var(--blue);
	}
	.stat-label {
		font-size: 13px;
		color: var(--text-muted);
	}
	.stat-divider {
		width: 1px;
		height: 36px;
		background: var(--border);
	}

	/* ── LOGOS ── */
	.logos {
		padding: 48px 24px;
		text-align: center;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		background: var(--bg-alt);
	}
	.logos-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 20px;
	}
	.logos-strip {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
		max-width: 700px;
		margin: 0 auto;
	}
	.logo-pill {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
		background: white;
		border: 1px solid var(--border);
		padding: 6px 16px;
		border-radius: 20px;
	}

	/* ── SECTION COMMON ── */
	.section-header {
		text-align: center;
		max-width: 600px;
		margin: 0 auto 48px;
	}
	.section-tag {
		display: inline-block;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: var(--blue);
		background: var(--blue-light);
		padding: 4px 14px;
		border-radius: 12px;
		margin-bottom: 16px;
	}
	.section-title {
		font-size: 36px;
		font-weight: 700;
		letter-spacing: -0.8px;
		line-height: 1.15;
		margin-bottom: 12px;
	}
	.section-sub {
		font-size: 16px;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	/* ── FEATURES ── */
	.features {
		padding: 96px 24px;
	}
	.features-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
		max-width: 1020px;
		margin: 0 auto;
	}
	.feature-card {
		background: white;
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 28px 24px;
		transition: all 0.25s;
	}
	.feature-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.06);
		border-color: rgba(43, 114, 238, 0.2);
	}
	.feature-icon {
		width: 44px;
		height: 44px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 16px;
	}
	.icon-capture { background: #EEF4FF; color: #2B72EE; }
	.icon-shield { background: #ECFDF5; color: #10B981; }
	.icon-share { background: #FFF7ED; color: #F18E2A; }
	.icon-guide { background: #F5F3FF; color: #6D5BF7; }
	.icon-check { background: #FEF3C7; color: #D97706; }
	.icon-chart { background: #FDE8E8; color: #EF4444; }
	.feature-title {
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 8px;
		letter-spacing: -0.2px;
	}
	.feature-desc {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.55;
	}

	/* ── HOW IT WORKS ── */
	.how {
		padding: 96px 24px;
		background: var(--bg-alt);
	}
	.steps {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 0;
		max-width: 900px;
		margin: 0 auto;
	}
	.step {
		text-align: center;
		flex: 1;
		max-width: 260px;
	}
	.step-number {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--blue);
		color: white;
		font-size: 20px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 16px;
	}
	.step-connector {
		width: 80px;
		height: 2px;
		background: linear-gradient(90deg, var(--blue), rgba(43, 114, 238, 0.2));
		margin-top: 23px;
		flex-shrink: 0;
	}
	.step-title {
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 8px;
	}
	.step-desc {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.55;
	}

	/* ── USE CASES ── */
	.usecases {
		padding: 96px 24px;
	}
	.usecases-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
		max-width: 960px;
		margin: 0 auto;
	}
	.usecase-card {
		background: white;
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 32px 24px;
		text-align: center;
		transition: all 0.25s;
	}
	.usecase-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.06);
	}
	.usecase-emoji {
		font-size: 36px;
		margin-bottom: 16px;
	}
	.usecase-title {
		font-size: 17px;
		font-weight: 600;
		margin-bottom: 10px;
		letter-spacing: -0.2px;
	}
	.usecase-desc {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	/* ── CTA BANNER ── */
	.cta-banner {
		padding: 80px 24px;
		background: linear-gradient(135deg, #2B72EE 0%, #1D4C9F 60%, #6D5BF7 100%);
		text-align: center;
	}
	.cta-inner {
		max-width: 560px;
		margin: 0 auto;
	}
	.cta-title {
		font-size: 32px;
		font-weight: 700;
		color: white;
		letter-spacing: -0.5px;
		margin-bottom: 12px;
	}
	.cta-sub {
		font-size: 16px;
		color: rgba(255, 255, 255, 0.8);
		margin-bottom: 32px;
	}
	.btn-cta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 14px 32px;
		background: white;
		color: var(--blue);
		font-size: 15px;
		font-weight: 600;
		font-family: inherit;
		border-radius: 10px;
		text-decoration: none;
		transition: all 0.2s;
	}
	.btn-cta:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
	}

	/* ── FOOTER ── */
	.footer {
		padding: 48px 24px 32px;
		border-top: 1px solid var(--border);
		background: var(--bg-alt);
	}
	.footer-inner {
		max-width: 960px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
	}
	.footer-brand {
		text-align: center;
	}
	.footer-logo {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-size: 16px;
		font-weight: 700;
		margin-bottom: 6px;
	}
	.footer-tagline {
		font-size: 13px;
		color: var(--text-muted);
	}
	.footer-links {
		display: flex;
		gap: 24px;
	}
	.footer-links a {
		font-size: 13px;
		color: var(--text-secondary);
		text-decoration: none;
		transition: color 0.2s;
	}
	.footer-links a:hover { color: var(--blue); }
	.footer-legal {
		text-align: center;
	}
	.footer-legal p {
		font-size: 12px;
		color: var(--text-muted);
		line-height: 1.6;
	}
	.footer-copy { margin-top: 4px; }
	.footer-copy a {
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.2s;
	}
	.footer-copy a:hover { color: var(--blue); }

	/* ── RESPONSIVE ── */
	@media (max-width: 768px) {
		.nav-links { display: none; }
		.nav-cta-mobile { display: block; }
		.hero { padding: 120px 20px 60px; }
		.hero-title { font-size: 32px; letter-spacing: -0.8px; }
		.hero-sub { font-size: 16px; }
		.hero-actions { flex-direction: column; gap: 12px; }
		.hero-stats { gap: 20px; }
		.stat-value { font-size: 22px; }
		.features-grid { grid-template-columns: 1fr; max-width: 400px; }
		.steps { flex-direction: column; align-items: center; gap: 0; }
		.step-connector { width: 2px; height: 32px; background: linear-gradient(180deg, var(--blue), rgba(43, 114, 238, 0.2)); margin: 0; }
		.usecases-grid { grid-template-columns: 1fr; max-width: 400px; }
		.section-title { font-size: 28px; }
		.cta-title { font-size: 24px; }
	}
	@media (max-width: 480px) {
		.hero-title { font-size: 28px; }
		.hero-stats { flex-direction: column; gap: 16px; }
		.stat-divider { width: 40px; height: 1px; }
	}
</style>
