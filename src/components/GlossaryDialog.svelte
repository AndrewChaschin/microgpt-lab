<script lang="ts">
	import { englishGlossary } from '$lib/i18n/glossary.en';
	import { language, t } from '$lib/i18n';
	import { tick } from 'svelte';
	import { glossary, type GlossaryKey } from '~/utils/glossary';

	$: definitions = $language === 'en' ? englishGlossary : glossary;
	let dialog: HTMLDialogElement;
	let term: GlossaryKey | undefined;
	let opener: HTMLButtonElement | undefined;

	async function openDefinition(event: MouseEvent) {
		if (!(event.target instanceof Element)) return;
		const trigger = event.target.closest<HTMLButtonElement>('button[data-glossary-term]');
		if (!trigger || dialog.open) return;
		const key = trigger.dataset.glossaryTerm;
		if (!key || !Object.prototype.hasOwnProperty.call(glossary, key)) return;
		opener = trigger;
		term = key as GlossaryKey;
		await tick();
		if (!dialog.open) dialog.showModal();
	}
</script>

<svelte:window on:click={openDefinition} />

<dialog
	bind:this={dialog}
	closedby="any"
	on:close={() => opener?.focus({ preventScroll: true })}
	aria-labelledby="glossary-title"
	aria-describedby="glossary-description"
>
	<header>
		<h2 id="glossary-title">{term ? definitions[term].title : ''}</h2>
		<form method="dialog">
			<button type="submit" aria-label={$t('Закрыть пояснение')}
				><span aria-hidden="true">×</span></button
			>
		</form>
	</header>
	<p id="glossary-description">{term ? definitions[term].description : ''}</p>
</dialog>

<style>
	:global(button.glossary-term) {
		display: inline;
		padding: 0;
		color: #1e429f;
		cursor: pointer;
		text-decoration-line: underline;
		text-decoration-style: dotted;
		text-underline-offset: 0.18em;
	}

	:global(button.glossary-term:hover) {
		text-decoration-style: solid;
	}

	:global(button.glossary-term:focus-visible) {
		outline: 2px solid currentColor;
		outline-offset: 0.13em;
	}

	dialog {
		box-sizing: border-box;
		width: min(29rem, calc(100% - 2rem));
		max-height: calc(100% - 2rem);
		margin: auto;
		padding: 1.1rem 1.25rem 1.3rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.7rem;
		color: #111827;
		background: white;
		box-shadow: 0 0.8rem 2.5rem rgb(15 23 42 / 0.24);
	}

	dialog::backdrop {
		background: rgb(15 23 42 / 0.45);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		margin-bottom: 0.55rem;
	}

	h2 {
		font-size: 1.15rem;
		font-weight: 650;
	}

	form button {
		display: grid;
		place-items: center;
		inline-size: 2rem;
		block-size: 2rem;
		border-radius: 0.35rem;
		background: #f3f4f6;
		font-size: 1.4rem;
	}

	p {
		line-height: 1.55;
	}
</style>
