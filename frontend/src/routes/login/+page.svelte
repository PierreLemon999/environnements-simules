<script lang="ts">
	import { goto } from '$app/navigation';
	import { login, loginWithGoogle } from '$lib/stores/auth';
	import { LogIn, Loader2, Mail, Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-svelte';

	let activeTab = $state<'client' | 'admin'>('client');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let showPassword = $state(false);
	let success = $state(false);
	let redirectTarget = $state('');

	async function handleClientLogin(e: Event) {
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
			redirectTarget = user.role === 'client' ? '/view' : '/admin';
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
		loading = true;
		error = '';

		try {
			const user = await loginWithGoogle(
				'mock-google-token',
				'marie.laurent@lemonlearning.com',
				'Marie Laurent',
				'google-marie-001',
				undefined
			);
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
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Connexion — Environnements Simulés</title>
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
					<div class="brand-logo">ES</div>
					<h1 class="brand-title">Environnements Simulés</h1>
					<p class="brand-subtitle">Plateforme de démonstrations Lemon Learning</p>
				</div>

				<!-- Tabs -->
				<div class="tabs">
					<button
						class="tab {activeTab === 'client' ? 'tab-active' : ''}"
						onclick={() => { activeTab = 'client'; error = ''; }}
					>
						Accès client
					</button>
					<button
						class="tab {activeTab === 'admin' ? 'tab-active' : ''}"
						onclick={() => { activeTab = 'admin'; error = ''; }}
					>
						Administration
					</button>
				</div>

				{#if activeTab === 'client'}
					<!-- Client login form -->
					<form onsubmit={handleClientLogin} class="login-form">
						<div class="form-group">
							<label for="email" class="form-label">Email</label>
							<div class="input-wrapper">
								<Mail size={16} class="input-icon" />
								<input
									id="email"
									type="email"
									placeholder="vous@entreprise.com"
									bind:value={email}
									disabled={loading}
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
									disabled={loading}
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

						{#if error}
							<div class="error-banner">
								<XCircle size={16} />
								<span>{error}</span>
							</div>
						{/if}

						<button type="submit" class="btn-primary" disabled={loading}>
							{#if loading}
								<Loader2 size={16} class="animate-spin" />
							{:else}
								<LogIn size={16} />
							{/if}
							Se connecter
						</button>
					</form>
				{:else}
					<!-- Admin Google SSO -->
					<div class="admin-section">
						<p class="admin-description">
							Connectez-vous avec votre compte Google Lemon Learning pour accéder à l'administration.
						</p>

						{#if error}
							<div class="error-banner">
								<XCircle size={16} />
								<span>{error}</span>
							</div>
						{/if}

						<button
							class="btn-google"
							onclick={handleGoogleLogin}
							disabled={loading}
						>
							{#if loading}
								<Loader2 size={16} class="animate-spin" />
							{:else}
								<svg width="18" height="18" viewBox="0 0 48 48">
									<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
									<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
									<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
									<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
								</svg>
							{/if}
							Continuer avec Google
						</button>
						<p class="admin-hint">(admin uniquement)</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
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
		background: radial-gradient(ellipse at 30% 20%, rgba(37, 99, 235, 0.06) 0%, transparent 50%),
					radial-gradient(ellipse at 70% 80%, rgba(37, 99, 235, 0.04) 0%, transparent 50%);
		pointer-events: none;
	}

	.bg-dots {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle, rgba(37, 99, 235, 0.07) 1px, transparent 1px);
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
		width: 600px;
		height: 600px;
		top: -200px;
		right: -150px;
		background: radial-gradient(circle, rgba(37, 99, 235, 0.1) 0%, rgba(124, 58, 237, 0.06) 50%, transparent 70%);
	}

	.login-container {
		position: relative;
		z-index: 10;
		width: 100%;
		max-width: 420px;
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

	.brand {
		text-align: center;
		margin-bottom: 28px;
	}

	.brand-logo {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border-radius: 14px;
		background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
		box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
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
		letter-spacing: -0.01em;
	}

	.brand-subtitle {
		margin-top: 4px;
		font-size: 14px;
		color: var(--color-muted-foreground);
	}

	/* Tabs */
	.tabs {
		display: flex;
		gap: 0;
		margin-bottom: 24px;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 3px;
		background: var(--color-accent, #f9fafb);
	}

	.tab {
		flex: 1;
		padding: 8px 16px;
		border: none;
		border-radius: 8px;
		background: transparent;
		font-size: 14px;
		font-weight: 500;
		font-family: inherit;
		color: var(--color-muted-foreground);
		cursor: pointer;
		transition: all 0.2s;
	}

	.tab:hover:not(.tab-active) {
		color: var(--color-foreground);
	}

	.tab-active {
		background: white;
		color: var(--color-foreground);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
		font-weight: 600;
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
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
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
		height: 40px;
		border: none;
		border-radius: 8px;
		background: var(--color-primary);
		color: white;
		font-size: 14px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: background-color 0.2s, box-shadow 0.2s;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--color-primary-hover);
		box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Admin section */
	.admin-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.admin-description {
		font-size: 14px;
		line-height: 1.5;
		color: var(--color-muted-foreground);
		text-align: center;
	}

	/* Google button */
	.btn-google {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		height: 40px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: white;
		color: var(--color-foreground);
		font-size: 14px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
	}

	.btn-google:hover:not(:disabled) {
		background: var(--color-input);
		border-color: var(--color-muted);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.btn-google:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.admin-hint {
		text-align: center;
		font-size: 12px;
		color: var(--color-muted);
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

	@media (max-width: 480px) {
		.login-card { padding: 32px 24px 28px; }
	}
</style>
