<script lang="ts">
	import { fmt, t, type Translate } from '$lib/i18n';
	import { boundary, vocabulary, type Lesson } from './model';
	import { blockName, connections, type Operation } from './operationGraph';
	import { signalTables, type Signal } from './signals';

	export let lesson: Lesson;
	export let node: Operation;
	export let position: number;
	export let phase: number;
	let mode = 'word';
	let branch = 0;
	let row = 0;
	type Channel = { label: string; signal: Signal };
	function channels(n: Operation, phase: number, tr: Translate): Channel[] {
		const reverse = phase === 2;
		const base = { index: n.stage, reverse };
		if (phase === 3)
			return [{ label: tr('Веса ') + tr(n.weight ?? ''), signal: { ...base, weight: n.weight } }];
		if (!reverse && n.id === 'mean')
			return [{ label: tr('Средняя ошибка'), signal: { ...base, seed: true } }];
		const edges =
			n.id === 'argmax'
				? connections.filter((e) => e.to === n)
				: connections.filter((e) => (reverse ? !e.discrete && e.to === n : e.from === n));
		if (!edges.length && n.weight)
			return [
				{ label: tr('Градиент ') + tr(n.weight ?? ''), signal: { ...base, weight: n.weight } }
			];
		return edges.map((edge) => ({
			label:
				n.id === 'argmax'
					? tr('Вероятности кандидатов')
					: reverse
						? tr('Градиент к блоку ') + tr(edge.from.name)
						: tr('К блоку ') + tr(edge.to.name),
			signal: { ...base, edge }
		}));
	}
	$: tokenLabel = (id: number) => (id === boundary ? $t('конец') : vocabulary[id]);
	function series(signal: Signal, after: boolean, lesson: Lesson, position: number, tr: Translate) {
		const frames = after && lesson.afterPositions ? lesson.afterPositions : lesson.positions;
		return signalTables(signal, lesson, frames, position, after, tr)[0];
	}
	$: choices = channels(node, phase, $t);
	$: choice = choices[Math.min(branch, choices.length - 1)];
	$: first = mode === 'block' && choice && series(choice.signal, false, lesson, position, $t);
	$: second =
		mode === 'block' &&
		choice &&
		phase !== 2 &&
		lesson.updated &&
		series(choice.signal, true, lesson, position, $t);
	$: rowIndex = first ? Math.min(row, first.values.length - 1) : 0;
	$: before =
		mode === 'word'
			? lesson.positions.map((f) => f.probabilities[f.target])
			: first
				? first.values[rowIndex]
				: [];
	$: after =
		mode === 'word'
			? (lesson.afterPositions?.map((f) => f.probabilities[f.target]) ?? [])
			: second
				? second.values[rowIndex]
				: [];
	$: numeric = before.every((v) => typeof v === 'number');
	$: values = numeric ? ([...before, ...after] as number[]) : [];
	$: probability =
		mode === 'word' ||
		(phase !== 2 && (choice?.signal.edge?.from.id === 'probabilities' || node.id === 'target'));
	$: high = probability ? 1 : Math.max(0, ...values);
	$: low = Math.min(0, ...values);
	$: top = high === low ? 1 : high;
	$: pitch = 530 / Math.max(before.length, 1);
	$: bar = Math.min(28, pitch * (after.length ? 0.35 : 0.68));
	const x = (i: number, pitch: number) => 64 + (i + 0.5) * pitch;
	const y = (v: number, lo: number, hi: number) => 104 - (90 * (v - lo)) / (hi - lo);
	$: baseline = y(0, low, top);
	$: labels = before.map((_, i) =>
		mode === 'word'
			? i + '·' + tokenLabel(lesson.positions[i].target)
			: choice?.signal.edge?.from.id === 'probabilities'
				? tokenLabel(i)
				: String(i)
	);
	$: title =
		mode === 'word'
			? $t('Вероятность следующего символа из слова')
			: blockName(node, phase, $t) + ' · ' + (first ? first.name : '');
	$: display = (v: number, percent: boolean) => (percent ? $fmt(v * 100) + ' %' : $fmt(v));
</script>

<section id="signal-chart" aria-label={$t('Графики данных схемы')}>
	<div class="settings">
		<select aria-label={$t('График')} bind:value={mode}
			><option value="word">{$t('Вероятность цели по позициям')}</option><option value="block"
				>{$t('Сигнал текущего блока')}</option
			></select
		>
		{#if mode === 'block' && choices.length > 1}
			<select
				aria-label={$t('Связь блока')}
				value={Math.min(branch, choices.length - 1)}
				on:change={(e) => {
					branch = Number(e.currentTarget.value);
					row = 0;
				}}
			>
				{#each choices as c, i}<option value={i}>{c.label}</option>{/each}
			</select>
		{/if}
		{#if first && first.values.length > 1}
			<label
				>{$t('Строка')}
				<select value={rowIndex} on:change={(e) => (row = Number(e.currentTarget.value))}>
					{#each first.values.keys() as i}<option value={i}>{i}</option>{/each}
				</select></label
			>
		{/if}
	</div>
	<figure>
		<figcaption>
			{title} · «{lesson.word}»{mode === 'block' ? $t(' · позиция ') + position : ''}
		</figcaption>
		{#if numeric && values.length}
			<div class="legend">
				<span
					>{after.length
						? $t('До обновления')
						: phase === 2 && mode === 'block'
							? $t('Градиент')
							: $t('Текущие значения')}</span
				>{#if after.length}<span>{$t('После обновления')}</span>{/if}
			</div>
			<svg viewBox="0 0 610 145" role="img" aria-label={title}>
				<line x1="64" x2="594" y1={baseline} y2={baseline} />
				<text x="60" y="17" text-anchor="end">{display(top, probability)}</text>
				<text x="60" y="106" text-anchor="end">{display(low, probability)}</text>
				{#each before as value, i}
					{@const cx = x(i, pitch)}
					{#each after.length ? [Number(value), Number(after[i])] : [Number(value)] as v, j}
						{@const vy = y(v, low, top)}
						<rect
							class:after={j === 1}
							x={cx + (after.length ? j - 1 : -0.5) * bar}
							y={Math.min(vy, baseline)}
							width={bar}
							height={Math.max(0.7, Math.abs(vy - baseline))}
						>
							<title
								>{labels[i]} · {after.length ? (j ? $t('после') : $t('до')) : ''}
								{display(v, probability)}</title
							>
						</rect>
					{/each}
					{#if before.length <= 32 || i % 4 === 0 || i === before.length - 1}
						<text
							class:selected={mode === 'word' && i === position}
							x={cx}
							y="119"
							text-anchor="middle">{labels[i]}</text
						>
					{/if}
				{/each}
				<text x="329" y="139" text-anchor="middle"
					>{mode === 'word'
						? $t('Позиция · ожидаемый символ')
						: choice?.signal.edge?.from.id === 'probabilities'
							? $t('Символ словаря')
							: $t('Индекс значения')}</text
				>
			</svg>
		{:else}
			<p>{before.join(' · ')}</p>
		{/if}
	</figure>
</section>

<style>
	section {
		border-top: 1px solid #dce6df;
		padding: 0.55rem 1rem;
		color: #284134;
		font-size: 0.8rem;
	}
	.settings,
	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem 0.8rem;
	}
	select {
		border: 1px solid #a9bfb2;
		border-radius: 0.3rem;
		padding: 0.2rem 1.8rem 0.2rem 0.4rem;
		max-width: 100%;
	}
	figure {
		margin: 0.4rem 0 0;
	}
	figcaption {
		font-weight: 650;
	}
	.legend span::before {
		content: '';
		display: inline-block;
		width: 0.65rem;
		height: 0.65rem;
		margin-right: 0.3rem;
		background: #74588a;
	}
	.legend span + span::before {
		background: #237554;
	}
	svg {
		width: min(100%, 42rem);
		height: auto;
	}
	rect {
		fill: #74588a;
	}
	rect.after {
		fill: #237554;
	}
	line {
		stroke: #718175;
	}
	text {
		fill: #49594f;
		font-size: 10px;
	}
	.selected {
		fill: #463059;
		font-weight: 750;
	}
</style>
