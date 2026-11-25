<script lang="ts">
	import { englishOperationExplanation } from '$lib/i18n/operationGuides.en';
	import { language, t } from '$lib/i18n';
	import GlossaryTerm from '~/components/GlossaryTerm.svelte';
	import { operationExplanation, type GuideId } from './operationGuides';

	export let id: GuideId;
	export let backward: boolean;
	$: guide =
		$language === 'en'
			? englishOperationExplanation(id, backward)
			: operationExplanation(id, backward);
</script>

<article class="operation-guide">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- Operation guides contain authored glossary buttons. -->
	<p>{@html guide.purpose}</p>
	<h3>{$t('Формула')}</h3>
	<pre class="formula">{guide.formula}</pre>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- Operation guides contain authored glossary buttons. -->
	<p>{@html guide.notation}</p>
	{#if guide.formula.includes('Σ')}
		<p class="notation">
			<GlossaryTerm term="summation">{$t('Знак Σ')}</GlossaryTerm>
			{$t('означает сумму по указанному индексу.')}
		</p>
	{/if}
	{#if backward}
		<p class="notation">
			g(v) = ∂L/∂v — <GlossaryTerm term="gradient">{$t('градиент')}</GlossaryTerm>
			{$t('средней ошибки L по величине v. Для одной координаты это')}
			<GlossaryTerm term="derivative">{$t('производная')}</GlossaryTerm>{$t(
				'. Запись += означает «прибавить вклад к уже накопленному».'
			)}
		</p>
	{/if}
	<h3>{$t('Псевдокод')}</h3>
	<pre class="pseudocode">{guide.pseudocode}</pre>
</article>

<style>
	.operation-guide {
		font-size: 0.88rem;
		line-height: 1.55;
	}
	p {
		margin: 0.6rem 0;
	}
	h3 {
		margin: 1rem 0 0.3rem;
		font-size: 0.93rem;
		font-weight: 700;
	}
	pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		padding: 0.65rem 0.8rem;
		border-radius: 0.35rem;
	}
	.formula {
		font-size: 0.98rem;
		background: #f4f0f7;
		color: #483451;
		line-height: 1.65;
	}
	.pseudocode {
		background: #f4f7f5;
		color: #254333;
		font-size: 0.83rem;
	}
	.notation {
		font-size: 0.81rem;
		color: #4e5056;
	}
</style>
