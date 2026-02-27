<script lang="ts">
	import { goto } from '$app/navigation';
	import { login, loginWithGoogle, loginDevBypass } from '$lib/stores/auth';
	import { LogIn, Loader2, Mail, Lock, Eye, EyeOff, CheckCircle, XCircle, KeyRound, ExternalLink } from 'lucide-svelte';

	let email = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let error = $state('');
	let loading = $state(false);
	let googleLoading = $state(false);
	let devLoading = $state(false);
	let devClientLoading = $state(false);
	let showPassword = $state(false);
	let success = $state(false);
	let redirectTarget = $state('');

	const isDev = import.meta.env.DEV;

	async function handleLogin(e: Event) {
		e.preventDefault();
		if (!email || !password) {
			error = 'Veuillez remplir tous les champs.';
			return;
		}

		loading = true;
		error = '';

		try {
			const user = await login(email, password);
			success = true;
			redirectTarget = user.role === 'admin' ? '/admin' : '/view';
			setTimeout(() => goto(redirectTarget), 1000);
		} catch (err: unknown) {
			if (err && typeof err === 'object' && 'message' in err) {
				error = (err as Error).message;
			} else {
				error = 'Une erreur est survenue lors de la connexion.';
			}
		} finally {
			loading = false;
		}
	}

	async function handleGoogleLogin() {
		googleLoading = true;
		error = '';

		try {
			const clientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID;

			if (!clientId) {
				error = 'Google Client ID non configuré. Utilisez le bouton Dev Login en développement.';
				googleLoading = false;
				return;
			}

			google.accounts.id.initialize({
				client_id: clientId,
				callback: async (response: GoogleCredentialResponse) => {
					try {
						const user = await loginWithGoogle(response.credential);
						success = true;
						redirectTarget = '/admin';
						setTimeout(() => goto(redirectTarget), 1000);
					} catch (err: unknown) {
						if (err && typeof err === 'object' && 'message' in err) {
							error = (err as Error).message;
						} else {
							error = 'Une erreur est survenue lors de la connexion Google.';
						}
					} finally {
						googleLoading = false;
					}
				}
			});

			google.accounts.id.prompt((notification: GooglePromptNotification) => {
				if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
					error = 'La fenêtre Google n\'a pas pu s\'afficher. Vérifiez votre bloqueur de popups.';
					googleLoading = false;
				}
			});
		} catch (err) {
			error = 'Impossible de charger la connexion Google.';
			googleLoading = false;
		}
	}

	async function handleDevLogin() {
		devLoading = true;
		error = '';

		try {
			const user = await loginDevBypass(
				'marie.laurent@lemonlearning.com',
				'Marie Laurent',
				'google-marie-001'
			);
			success = true;
			redirectTarget = '/admin';
			setTimeout(() => goto(redirectTarget), 1000);
		} catch (err: unknown) {
			if (err && typeof err === 'object' && 'message' in err) {
				error = (err as Error).message;
			} else {
				error = 'Erreur lors du dev login.';
			}
		} finally {
			devLoading = false;
		}
	}

	async function handleDevClientLogin() {
		devClientLoading = true;
		error = '';

		try {
			const user = await login('sophie.martin@acme-corp.fr', 'client123');
			success = true;
			redirectTarget = '/view';
			setTimeout(() => goto(redirectTarget), 1000);
		} catch (err: unknown) {
			if (err && typeof err === 'object' && 'message' in err) {
				error = (err as Error).message;
			} else {
				error = 'Erreur lors du dev login client.';
			}
		} finally {
			devClientLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Connexion — Lemon Lab</title>
</svelte:head>

<div class="login-page">
	<!-- Background decorations -->
	<div class="bg-gradient"></div>
	<div class="bg-dots"></div>
	<div class="bg-shape shape-1"></div>

	<div class="login-container">
		{#if success}
			<div class="login-card success-card fade-up">
				<div class="success-content">
					<div class="success-icon">
						<CheckCircle size={48} strokeWidth={1.5} />
					</div>
					<h2 class="success-title">Connexion réussie</h2>
					<p class="success-subtitle">Redirection vers votre tableau de bord...</p>
				</div>
			</div>
		{:else}
			<div class="login-card fade-up" style="animation-delay: 100ms">
				<!-- Brand -->
				<div class="brand">
					<div class="brand-logo">
						<svg width="26" height="26" viewBox="0 0 32 32" fill="none">
							<path d="M12 4 L12 13 L6 25 Q5 27 7 28 L25 28 Q27 27 26 25 L20 13 L20 4" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
							<line x1="10" y1="4" x2="22" y2="4" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
							<path d="M8.5 21 L12.5 14 L19.5 14 L23.5 21 Q25 24 24 26 Q23 27 22 27 L10 27 Q9 27 8 26 Q7 24 8.5 21Z" fill="rgba(255,255,255,0.2)"/>
							<circle cx="14" cy="22" r="1.8" fill="#FAE100"/>
							<circle cx="18.5" cy="19" r="1.3" fill="rgba(255,255,255,0.5)"/>
							<circle cx="11.5" cy="18.5" r="1" fill="#FAE100" opacity="0.7"/>
						</svg>
					</div>
					<h1 class="brand-title">Lemon Lab</h1>
					<p class="brand-subtitle">Lemon Learning</p>
				</div>

				<!-- Section label -->
				<div class="section-label">
					<Lock size={13} />
					<span>Identifiants</span>
				</div>

				<!-- Unified login form -->
				<form onsubmit={handleLogin} class="login-form">
					<div class="form-group">
						<label for="email" class="form-label">Adresse e-mail</label>
						<div class="input-wrapper">
							<Mail size={16} class="input-icon" />
							<input
								id="email"
								type="email"
								placeholder="vous@entreprise.com"
								bind:value={email}
								disabled={loading || googleLoading}
								class="form-input"
							/>
						</div>
					</div>

					<div class="form-group">
						<label for="password" class="form-label">Mot de passe</label>
						<div class="input-wrapper">
							<Lock size={16} class="input-icon" />
							<input
								id="password"
								type={showPassword ? 'text' : 'password'}
								placeholder="Votre mot de passe"
								bind:value={password}
								disabled={loading || googleLoading}
								class="form-input has-toggle"
							/>
							<button
								type="button"
								class="password-toggle"
								onclick={() => showPassword = !showPassword}
								tabindex={-1}
								aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
							>
								{#if showPassword}
									<EyeOff size={16} />
								{:else}
									<Eye size={16} />
								{/if}
							</button>
						</div>
					</div>

					<!-- Remember me + Forgot password -->
					<div class="form-options">
						<label class="remember-me">
							<input
								type="checkbox"
								bind:checked={rememberMe}
								disabled={loading || googleLoading}
							/>
							<span>Se souvenir de moi</span>
						</label>
						<a href="/forgot-password" class="forgot-password">Mot de passe oublié ?</a>
					</div>

					{#if error}
						<div class="error-banner">
							<XCircle size={16} />
							<span>{error}</span>
						</div>
					{/if}

					<button type="submit" class="btn-primary" disabled={loading || googleLoading}>
						{#if loading}
							<Loader2 size={16} class="animate-spin" />
						{:else}
							<LogIn size={16} />
						{/if}
						Se connecter
					</button>
				</form>

				<p class="form-hint">Accès pour les équipes et les clients avec leurs identifiants</p>

				<!-- Divider -->
				<div class="divider">
					<div class="divider-line"></div>
					<span class="divider-text">ou se connecter avec</span>
					<div class="divider-line"></div>
				</div>

				<!-- Google SSO -->
				<div class="google-section">
					<button
						class="btn-google"
						onclick={handleGoogleLogin}
						disabled={loading || googleLoading}
					>
						{#if googleLoading}
							<Loader2 size={16} class="animate-spin" />
						{:else}
							<svg width="18" height="18" viewBox="0 0 48 48">
								<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
								<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
								<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
								<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
							</svg>
						{/if}
						Se connecter avec Google
					</button>
					<p class="google-hint">(admin uniquement)</p>
				</div>
			</div>

			<!-- Footer -->
			<div class="login-footer fade-up" style="animation-delay: 200ms">
				Propulsé par <span class="footer-brand">Lemon Learning</span>
				<br />&copy; 2026 Lab &middot; Confidentialité &middot; Conditions
			</div>
		{/if}
	</div>

	<!-- Magic doors — dev only -->
	{#if isDev}
		<div class="magic-doors">
			<button
				class="magic-door magic-door-admin"
				onclick={handleDevLogin}
				disabled={loading || googleLoading || devLoading || devClientLoading}
				title="Connexion rapide en tant qu'admin (dev uniquement)"
			>
				{#if devLoading}
					<Loader2 size={14} class="animate-spin" />
				{:else}
					<KeyRound size={14} />
				{/if}
				Admin
			</button>
			<button
				class="magic-door magic-door-client"
				onclick={handleDevClientLogin}
				disabled={loading || googleLoading || devLoading || devClientLoading}
				title="Connexion rapide en tant que client (dev uniquement)"
			>
				{#if devClientLoading}
					<Loader2 size={14} class="animate-spin" />
				{:else}
					<Eye size={14} />
				{/if}
				Client
			</button>
			<a
				class="magic-door magic-door-site"
				href="https://getlemonlab.com"
				target="_blank"
				rel="noopener noreferrer"
				title="Voir le site vitrine en production"
			>
				<ExternalLink size={14} />
				Site
			</a>
		</div>
	{/if}
</div>

<style>
	@keyframes fadeUp {
		from { opacity: 0; transform: translateY(16px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes shapeFloat {
		0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
		25% { transform: translate(30px, -20px) scale(1.05); opacity: 0.7; }
		50% { transform: translate(-10px, 20px) scale(0.95); opacity: 0.6; }
		75% { transform: translate(20px, 10px) scale(1.02); opacity: 0.9; }
	}

	.fade-up { animation: fadeUp 0.6s ease-out both; }

	.login-page {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		overflow: hidden;
		background: #fafafa;
	}

	.bg-gradient {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at 30% 20%, rgba(43, 114, 238, 0.06) 0%, transparent 50%),
					radial-gradient(ellipse at 70% 80%, rgba(43, 114, 238, 0.04) 0%, transparent 50%);
		pointer-events: none;
	}

	.bg-dots {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle, rgba(43, 114, 238, 0.07) 1px, transparent 1px);
		background-size: 24px 24px;
		pointer-events: none;
	}

	.bg-shape {
		position: absolute;
		border-radius: 50%;
		filter: blur(80px);
		pointer-events: none;
		animation: shapeFloat 20s ease-in-out infinite;
	}

	.shape-1 {
		width: 720px;
		height: 720px;
		top: -220px;
		right: -160px;
		background: radial-gradient(circle, rgba(43, 114, 238, 0.12) 0%, rgba(124, 58, 237, 0.07) 50%, transparent 70%);
	}

	.login-container {
		position: relative;
		z-index: 10;
		width: 100%;
		max-width: 440px;
		padding: 0 16px;
	}

	.login-card {
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 16px;
		padding: 44px 40px 40px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
		transition: box-shadow 0.3s ease;
	}

	.login-card:hover {
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
	}

	/* Brand */
	.brand {
		text-align: center;
		margin-bottom: 36px;
	}

	.brand-logo {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border-radius: 14px;
		background: linear-gradient(135deg, #2B72EE 0%, #1D4C9F 100%);
		box-shadow: 0 4px 12px rgba(43, 114, 238, 0.3);
		color: white;
		font-size: 18px;
		font-weight: 700;
		margin: 0 auto 16px;
		letter-spacing: -0.02em;
	}

	.brand-title {
		font-size: 21px;
		font-weight: 700;
		color: var(--color-foreground);
		letter-spacing: -0.4px;
	}

	.brand-subtitle {
		margin-top: 4px;
		font-size: 13px;
		color: var(--color-muted);
	}

	/* Section label */
	.section-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--color-muted);
		margin-bottom: 14px;
	}

	.section-label :global(svg) {
		width: 13px;
		height: 13px;
	}

	/* Form */
	.login-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-foreground);
	}

	.input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.input-wrapper :global(.input-icon) {
		position: absolute;
		left: 12px;
		color: var(--color-muted);
		pointer-events: none;
		z-index: 1;
	}

	.form-input {
		width: 100%;
		height: 40px;
		padding: 0 12px 0 38px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: transparent;
		font-size: 14px;
		font-family: inherit;
		color: var(--color-foreground);
		transition: border-color 0.2s, box-shadow 0.2s;
		outline: none;
	}

	.form-input.has-toggle {
		padding-right: 40px;
	}

	.form-input::placeholder {
		color: var(--color-muted);
	}

	.form-input:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(43, 114, 238, 0.12);
	}

	.form-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.password-toggle {
		position: absolute;
		right: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		border-radius: 6px;
		transition: color 0.2s, background-color 0.2s;
	}

	.password-toggle:hover {
		color: var(--color-foreground);
		background: var(--color-input);
	}

	/* Form options (remember me + forgot password) */
	.form-options {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: -4px;
	}

	.remember-me {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--color-muted-foreground);
		cursor: pointer;
		user-select: none;
	}

	.remember-me input[type="checkbox"] {
		width: 15px;
		height: 15px;
		border-radius: 4px;
		accent-color: var(--color-primary);
		cursor: pointer;
	}

	.forgot-password {
		font-size: 13px;
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s;
	}

	.forgot-password:hover {
		color: var(--color-primary-hover, #245FC6);
		text-decoration: underline;
	}

	/* Error banner */
	.error-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		font-size: 13px;
		color: #dc2626;
	}

	.error-banner :global(svg) {
		flex-shrink: 0;
	}

	/* Primary button */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 12px 20px;
		border: none;
		border-radius: 8px;
		background: var(--color-primary);
		color: white;
		font-size: 14px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--color-primary-hover);
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(43, 114, 238, 0.3);
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Form hint */
	.form-hint {
		text-align: center;
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.5;
		margin-top: 16px;
	}

	/* Divider */
	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 24px 0;
	}

	.divider-line {
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.divider-text {
		font-size: 12px;
		color: var(--color-muted);
		white-space: nowrap;
	}

	/* Google section */
	.google-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.btn-google {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		padding: 13px 20px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: white;
		color: var(--color-foreground);
		font-size: 14px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		position: relative;
		overflow: hidden;
	}

	.btn-google:hover:not(:disabled) {
		border-color: #d6d3d1;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}

	.btn-google:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.google-hint {
		font-size: 12px;
		color: var(--color-muted);
		text-align: center;
	}

	/* Footer */
	.login-footer {
		text-align: center;
		margin-top: 28px;
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.6;
	}

	.footer-brand {
		font-weight: 500;
		color: var(--color-muted-foreground);
	}

	/* Success */
	.success-card {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 300px;
	}

	.success-content { text-align: center; }

	.success-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 16px;
		color: var(--color-success);
	}

	.success-title {
		font-size: 20px;
		font-weight: 600;
		color: var(--color-foreground);
		margin-bottom: 8px;
	}

	.success-subtitle {
		font-size: 14px;
		color: var(--color-muted-foreground);
	}

	/* Magic doors — dev only, centered between card right edge and screen right edge */
	.magic-doors {
		position: fixed;
		top: 50%;
		right: calc((100vw - 440px) / 4);
		transform: translate(50%, -50%);
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 100;
	}

	.magic-door {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border: 1px solid #e5e7eb;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(8px);
		color: #6b7280;
		font-size: 12px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		white-space: nowrap;
	}

	.magic-door-admin:hover:not(:disabled) {
		color: #2B72EE;
		border-color: #2B72EE;
		box-shadow: 0 4px 12px rgba(43, 114, 238, 0.15);
	}

	.magic-door-client:hover:not(:disabled) {
		color: #F18E2A;
		border-color: #F18E2A;
		box-shadow: 0 4px 12px rgba(241, 142, 42, 0.15);
	}

	.magic-door-site {
		text-decoration: none;
	}

	.magic-door-site:hover {
		color: #10B981;
		border-color: #10B981;
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
	}

	.magic-door:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	@media (max-width: 480px) {
		.login-card { padding: 32px 24px 28px; }
		.form-options { flex-direction: column; align-items: flex-start; gap: 8px; }
	}
</style>
