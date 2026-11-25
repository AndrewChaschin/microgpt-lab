<script lang="ts">
	import katex from 'katex';
	import { t } from '$lib/i18n';
	import 'katex/dist/katex.min.css';

	export let tex: string;
	export let inline = false;
	export let notation = '';
	$: expression = notation ? tex + String.raw`,\quad\text{${$t('где')}}` : tex;
	$: lines = expression
		.trim()
		.split('\n')
		.map((line) => katex.renderToString(line, { displayMode: !inline, output: 'htmlAndMathml' }));
	// Notation is authored text with glossary buttons and $...$ math spans.
	$: definitions = notation
		.split('\n')
		.filter(Boolean)
		.map((line) =>
			line.replace(/\$([^$\n]+)\$/g, (_, symbol: string) => katex.renderToString(symbol))
		);
</script>

<span class="formula" class:inline>
	<span class="equations">
		{#each lines as line}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- KaTeX renders authored expressions with trust disabled. -->
			<span>{@html line}</span>
		{/each}
	</span>
	{#each definitions as definition}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- Authored glossary buttons and KaTeX markup. -->
		<span class="notation katex">{@html definition}</span>
	{/each}
</span>

<style>
	.formula {
		display: block;
		margin: 0.5rem 0;
		padding: 0.55rem 0.85rem;
		color: #382e49;
		background: #f6f3f9;
		border-inline-start: 3px solid #a58ab5;
		font-size: 0.97rem;
	}
	.notation {
		display: block;
		margin-top: 0.45rem;
		line-height: 1.45;
	}
	.notation :global(.katex) {
		font-size: 1em;
	}
	.equations {
		display: block;
		overflow-x: auto;
	}
	.formula.inline {
		display: inline-block;
		vertical-align: middle;
		max-width: 100%;
		padding: 0.1rem;
		margin: 0;
		background: transparent;
		border: 0;
	}
	.formula :global(.katex-display) {
		margin: 0.35rem 0;
	}
	.formula :global(.katex-display > .katex) {
		text-align: left;
	}
</style>
