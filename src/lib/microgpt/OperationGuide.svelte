<script lang="ts">
	import { englishOperationExplanation } from '$lib/i18n/operationGuides.en';
	import { language, t } from '$lib/i18n';
	import Formula from './Formula.svelte';
	import { glossaryButton as term } from '~/utils/glossary';
	import { operationExplanation, type GuideId } from './operationGuides';

	export let id: GuideId;
	export let backward: boolean;
	$: guide =
		$language === 'en'
			? englishOperationExplanation(id, backward)
			: operationExplanation(id, backward);
	$: gradientNote = $t(
		'$g(v)$ — {gradient} средней ошибки слова по величине $v$. Для одной координаты это {derivative}. Знак {add} означает, что вклад прибавляют к уже накопленному.',
		{
			gradient: term('gradient', $t('градиент')),
			derivative: term('derivative', $t('производная')),
			add: String.raw`$\mathrel{+\!=}$`
		}
	);
	$: notation = backward ? guide.notation + '\n' + gradientNote : guide.notation;
</script>

<article class="operation-guide">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- Operation guides contain authored glossary buttons. -->
	<p>{@html guide.purpose}</p>
	<slot />
	<h3>{$t('Формула')}</h3>
	<Formula tex={guide.formula} {notation} />
	<details>
		<summary>{$t('Псевдокод')}</summary>
		<pre class="pseudocode">{guide.pseudocode}</pre>
	</details>
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
	details {
		margin-top: 0.8rem;
	}
	summary {
		cursor: pointer;
		font-weight: 650;
	}
	.pseudocode {
		background: #f4f7f5;
		color: #254333;
		font-size: 0.83rem;
	}
</style>
