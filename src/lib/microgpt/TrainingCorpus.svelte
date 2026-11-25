<script lang="ts">
	import { t } from '$lib/i18n';
	import { tick } from 'svelte';
	import type { Lesson } from './model';
	import { corpora } from './corpora';
	export let lesson: Lesson;
	export let busy: boolean;

	export let onWord: (index: number) => void;
	let list: HTMLOListElement;
	let sourceY = 50;
	$: ({ words } = corpora[lesson.language]);
	$: selected = words.indexOf(lesson.word);
	$: if (list) reveal(list, selected);
	function measure() {
		if (!list) return;
		const row = list.children[selected];
		if (row) {
			const bounds = list.getBoundingClientRect();
			const item = row.getBoundingClientRect();
			if (bounds.height)
				sourceY = (100 * (item.top + item.height / 2 - bounds.top)) / bounds.height;
		}
	}
	async function reveal(container: HTMLOListElement, index: number) {
		await tick();
		const row = container.children[index] as HTMLElement;
		if (!row) return;
		if (
			row.offsetTop < container.scrollTop ||
			row.offsetTop + row.offsetHeight > container.scrollTop + container.clientHeight
		)
			container.scrollTop = row.offsetTop - (container.clientHeight - row.offsetHeight) / 2;
		measure();
	}
</script>

<svelte:window on:resize={measure} />
<div class="corpus">
	<ol bind:this={list} on:scroll={measure} aria-label={$t('Слова учебного корпуса')}>
		{#each words as word, i}
			<li>
				<button
					type="button"
					disabled={busy}
					aria-pressed={i === selected}
					on:click={() => onWord(i)}><small>{i + 1}</small>{word}</button
				>
			</li>
		{/each}
	</ol>
	<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
		{#if sourceY >= 0 && sourceY <= 100}
			<path class="selected" d={'M0 ' + sourceY + ' H45 V50 H100'} />
		{/if}
	</svg>
</div>

<style>
	.corpus {
		position: relative;
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 1.35rem;
		min-height: 0;
	}
	ol {
		position: relative;
		overflow-y: auto;
		overscroll-behavior: contain;
		border: 1px solid #d7dfda;
		border-radius: 0.35rem;
		scrollbar-width: thin;
		min-height: 0;
	}
	li button {
		display: flex;
		align-items: center;
		gap: 0.28rem;
		width: 100%;
		text-align: left;
		padding: 0.22rem 0.27rem;
		font-size: 0.74rem;
	}
	small {
		font-size: 0.62rem;
		color: #69786f;
		min-width: 1.15rem;
	}
	li button:hover {
		background: #f1f5f2;
	}
	li button[aria-pressed='true'] {
		background: #deeae4;
		color: #204e38;
		font-weight: 700;
		box-shadow: inset 3px 0 #417959;
	}
	svg {
		width: 100%;
		height: 100%;
	}
	path {
		fill: none;
		stroke: #cec4d9;
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	path.selected {
		stroke: #704e91;
		stroke-width: 2;
	}
</style>
