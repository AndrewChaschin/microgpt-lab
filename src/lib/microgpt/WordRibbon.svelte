<script lang="ts">
	import { fmt, t } from '$lib/i18n';
	import type { Lesson } from './model';
	import { corpora } from './corpora';
	import { operations } from './operationGraph';
	import CircuitEdge from './CircuitEdge.svelte';
	import type SignalProbe from './SignalProbe.svelte';

	export let lesson: Lesson;
	export let position: number;
	export let phase: number;
	export let onPosition: (index: number) => void;
	export let probe: SignalProbe;

	const labelWidth = 102;
	const cellWidth = 58;
	const center = (index: number) => labelWidth + (index + 0.5) * cellWidth;
	const reader = operations.find((node) => node.id === 'symbol')!;
	$: ({ boundary, vocabulary } = corpora[lesson.language]);
	$: symbol = (id: number, end = false) =>
		id === boundary ? (end ? $t('конец') : $t('начало')) : vocabulary[id];
	$: count = lesson.positions.length;
	$: width = labelWidth + count * cellWidth + 24;
	$: middle = (center(0) + center(count - 1)) / 2;
	$: showLoss = phase === 1 || phase === 2;
</script>

<svg
	class="word-ribbon"
	{width}
	height={showLoss ? 274 : 140}
	aria-label={$t('Предсказания для слова «{word}»', { word: lesson.word })}
>
	<text class="word" x="12" y="20">{$t('Учебное слово «{word}»', { word: lesson.word })}</text>
	<path class="input-lead" d="M0 82 H9" />
	<text class="row-label" x="12" y="86">{$t('Вход')}</text>
	<text class="row-label" x="12" y="115">{$t('Следующий')}</text>
	<text class="row-label" x="12" y="130">{$t('символ')}</text>
	<CircuitEdge
		{probe}
		signal={{ index: 0, reverse: false, wordInput: true }}
		points={[
			[center(position), 66],
			[center(position), 42],
			[width - 12, 42],
			[width - 12, reader.y],
			[width + reader.x - reader.w / 2, reader.y]
		]}
		label=""
		name={$t('Входной символ выбранной позиции')}
	/>
	{#each lesson.positions as frame, i}
		<foreignObject x={labelWidth + i * cellWidth + 2} y="66" width={cellWidth - 4} height="70">
			<button
				type="button"
				class="pair"
				aria-pressed={position === i}
				title={$t('Позиция ') +
					i +
					' · ' +
					symbol(frame.token) +
					' → ' +
					symbol(frame.target, true)}
				aria-label={$t('Позиция ') +
					i +
					$t(', вход ') +
					symbol(frame.token) +
					$t(', следующий символ ') +
					symbol(frame.target, true)}
				on:click={() => onPosition(i)}
			>
				<span class="input" class:read={i <= position}>{symbol(frame.token)}</span>
				<span class="target">{symbol(frame.target, true)}</span>
			</button>
		</foreignObject>
	{/each}
	{#if showLoss}
		<g class="loss-branches" class:backward={phase === 2}>
			<text class="row-label" x="12" y="166">{$t('Ошибка ℓ')}</text>
			{#each lesson.positions as frame, i}
				<g class:selected={position === i}>
					<text class="loss" x={center(i)} y="166"
						>{$fmt(-Math.log(frame.probabilities[frame.target]))}</text
					>
					<path
						d={'M' + center(i) + ' 193 V175'}
						marker-end={phase === 2 ? 'url(#arrow-back)' : undefined}
					/>
				</g>
			{/each}
			<path d={'M' + center(0) + ' 193 H' + center(count - 1)} />
			<path
				d={'M' + middle + ' 193 V215'}
				marker-end={phase === 1 ? 'url(#arrow-forward)' : undefined}
			/>
			<text class="mean" x={middle} y="236"
				>{$t('Средняя ошибка по {count} предсказаниям · {loss}', {
					count,
					loss: $fmt(lesson.loss)
				})}</text
			>
			{#if phase === 2}
				<text class="share" x={middle} y="257"
					>{$t('К каждой ошибке возвращается градиент 1/')}{count}</text
				>
			{/if}
		</g>
	{/if}
</svg>

<style>
	.word-ribbon {
		display: block;
		overflow: visible;
	}
	.word {
		font-size: 17px;
		font-weight: 700;
		fill: #443352;
	}
	.row-label {
		font-size: 13px;
		fill: #536158;
	}
	.pair {
		display: grid;
		grid-template-rows: 1fr 1fr;
		gap: 4px;
		width: 100%;
		height: 100%;
		padding: 0;
		text-align: center;
		cursor: pointer;
	}
	.pair span {
		display: grid;
		place-items: center;
		border: 1px solid #d4dcd6;
		border-radius: 4px;
		font-size: 15px;
		line-height: 1;
		background: #fafbf9;
		color: #39463d;
	}
	.pair .read {
		background: #eae2f2;
		border-color: #c6b4d2;
		color: #493257;
	}
	.pair[aria-pressed='true'] .input {
		border: 2px solid #70518a;
		font-weight: 700;
	}
	.pair[aria-pressed='true'] .target {
		background: #64457b;
		color: white;
		border-color: #64457b;
		font-weight: 700;
	}
	.pair:hover span,
	.pair:focus-visible span {
		border-color: #55396b;
	}
	.pair:focus-visible {
		outline: 2px solid #55396b;
		outline-offset: -2px;
	}
	.input-lead {
		stroke: #735d87;
		stroke-width: 2;
	}
	.loss-branches {
		color: #735d87;
	}
	.loss-branches.backward {
		color: #42785c;
	}
	.loss-branches path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
	}
	.loss,
	.mean,
	.share {
		text-anchor: middle;
		fill: currentColor;
	}
	.loss,
	.share {
		font-size: 13px;
	}
	.mean {
		font-weight: 650;
		font-size: 15px;
	}
	.selected .loss {
		font-weight: 700;
	}
	.selected path {
		stroke-width: 2.5;
	}
</style>
