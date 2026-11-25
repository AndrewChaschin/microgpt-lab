<script lang="ts">
	import { language, t } from '$lib/i18n';
	import { boundary, vocabulary, words } from './model';
	import type { Snapshot } from './training.worker';

	export let snapshot: Snapshot;
	let wordIndex = 0;
	let position = 0;
	$: number = new Intl.NumberFormat($language, { maximumFractionDigits: 5 });
	$: percent = new Intl.NumberFormat($language, { style: 'percent', maximumSignificantDigits: 3 });
	$: symbol = (id: number) => (id === boundary ? $t('конец слова') : vocabulary[id]);
	$: validation = snapshot.validation;
	$: sample = validation.forecasts[wordIndex];
	$: result = sample.positions[position];
	$: rows = [
		{ label: $t('Учебные'), count: words.length, metrics: snapshot.trainingMetrics },
		{ label: $t('Проверочные'), count: validation.forecasts.length, metrics: validation.metrics }
	];
</script>

<section class="evaluation" aria-label={$t('Качество предсказаний')}>
	<table>
		<caption>{$t('Качество модели · шаг')} {snapshot.step}</caption>
		<thead
			><tr
				><th scope="col">{$t('Слова')}</th><th
					scope="col"
					title={$t('Средняя по словам ошибка предсказания следующего символа')}
					>{$t('Средняя ошибка')}</th
				><th
					scope="col"
					title={$t(
						'Совпадения наиболее вероятного символа с целью по всем позициям, включая конец слова'
					)}>{$t('Верных прогнозов')}</th
				></tr
			></thead
		>
		<tbody>
			{#each rows as { label, count, metrics }}
				<tr
					><th scope="row">{label} ({count})</th><td>{number.format(metrics.loss)}</td><td
						>{metrics.correct}
						{$t('из')}
						{metrics.positions} ({percent.format(metrics.correct / metrics.positions)})</td
					></tr
				>
			{/each}
		</tbody>
	</table>
	<details>
		<summary>{$t('Проверить предсказание на слове')}</summary>
		<p>
			{$t(
				'Эти слова отложены для проверки. Выберите начало слова, чтобы увидеть прогноз следующего символа. Оба процента показывают вероятности, рассчитанные моделью.'
			)}
		</p>
		<div class="controls">
			<label
				>{$t('Проверочное слово')}
				<select
					value={wordIndex}
					on:change={(e) => {
						wordIndex = Number(e.currentTarget.value);
						position = 0;
					}}
				>
					{#each validation.forecasts as forecast, i}<option value={i}>{forecast.word}</option
						>{/each}
				</select>
			</label>
			<label
				>{$t('Что уже прочитано')}
				<select bind:value={position}>
					{#each sample.positions.keys() as i}<option value={i}
							>{i ? sample.word.slice(0, i) : $t('начало слова')}</option
						>{/each}
				</select>
			</label>
		</div>
		<dl class="comparison" aria-live="polite">
			<div>
				<dt>{$t('Прогноз модели')}</dt>
				<dd><strong>{symbol(result.predicted)}</strong> · {percent.format(result.probability)}</dd>
			</div>
			<div>
				<dt>{$t('Следом в слове')}</dt>
				<dd>
					<strong>{symbol(result.target)}</strong> · {percent.format(result.targetProbability)}
				</dd>
			</div>
		</dl>
	</details>
</section>

<style>
	.evaluation {
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 0.6rem 2rem;
		padding: 0.65rem 1.25rem;
		border-bottom: 1px solid #dce6df;
		color: #294536;
		font-size: 0.8rem;
	}
	table {
		max-width: 100%;
		font-variant-numeric: tabular-nums;
	}
	caption,
	th {
		text-align: left;
	}
	caption,
	summary {
		font-weight: 650;
	}
	th,
	td {
		padding: 0.15rem 0.75rem 0.15rem 0;
	}
	th:last-child,
	td:last-child {
		padding-right: 0;
	}
	thead th {
		font-weight: 500;
	}
	td {
		text-align: right;
	}
	details {
		flex: 1 1 17rem;
		min-width: 0;
	}
	summary {
		cursor: pointer;
		width: fit-content;
	}
	p {
		margin: 0.4rem 0;
	}
	.controls,
	.comparison {
		display: flex;
		gap: 0.5rem 1.25rem;
		flex-wrap: wrap;
	}
	label,
	.comparison div {
		display: grid;
		gap: 0.15rem;
	}
	select {
		border: 1px solid #b1c7ba;
		border-radius: 0.3rem;
		padding: 0.2rem 1.7rem 0.2rem 0.4rem;
		background-color: white;
	}
	.comparison {
		margin-top: 0.6rem;
	}
	dd {
		font-variant-numeric: tabular-nums;
	}
</style>
