<script lang="ts">
	import { t } from '$lib/i18n';
	import DiagramViewport from './DiagramViewport.svelte';
	import GlossaryTerm from '~/components/GlossaryTerm.svelte';
	import { words, type ForwardPosition, type Weight } from './model';
	import type { Snapshot } from './training.worker';
	import SignalProbe from './SignalProbe.svelte';
	import type { Signal } from './signals';
	import TrainingCorpus from './TrainingCorpus.svelte';
	import WordRibbon from './WordRibbon.svelte';
	import { circuitWidth, operations, phaseNodes, type Operation } from './operationGraph';

	import ColumnDialog from './ColumnDialog.svelte';
	import ModelCircuit from './ModelCircuit.svelte';
	import StepPlayback from './StepPlayback.svelte';
	import SignalChart from './SignalChart.svelte';
	export let positions: ForwardPosition[];
	export let phase: number;
	let playing = false;
	export let snapshot: Snapshot;
	export let position: number;
	export let stages: string[];
	export let busy: boolean;
	export let onPosition: (p: number) => void;
	export let onWord: (i: number) => void;
	let index = 0;
	let chartOpen = false;
	let columnDialog: ColumnDialog;
	function selectColumn(index: number, options: Parameters<ColumnDialog['open']>[1] = {}) {
		playing = false;
		columnDialog.open(index, options);
	}
	let probe: SignalProbe;
	let activeWeight: Weight | undefined;
	function inspectSignal(s: Signal) {
		if (s.output) {
			const node = operations.find((n) => n.id === s.output)!;
			selectColumn(node.stage, { node });
			return;
		}
		if (s.edge) {
			const n = s.reverse ? s.edge.to : s.edge.from;
			selectColumn(n.stage, { node: n, backward: s.reverse });
			return;
		}
		if (s.index === 6) {
			selectColumn(6, { transition: true, backward: s.reverse });
			return;
		}
		selectColumn(s.reverse && s.index === 0 ? 1 : s.index, {
			backward: s.reverse && !s.weight,
			weight: s.weight
		});
	}
	$: lesson = snapshot.lesson;
	function resetCursor(selected: Snapshot['lesson']) {
		playing = false;
		index = selected.updated ? phaseNodes[4].length - 1 : 0;
		probe?.close();
	}
	$: resetCursor(lesson);
	$: current = phaseNodes[phase][index] ?? phaseNodes[phase][0];
	function inspectBlock(node: Operation, backward: boolean, optimizer = false) {
		const next = optimizer ? 3 : backward ? 2 : node.stage === 6 ? 1 : phase === 4 ? 4 : 0;
		if (next <= 2 || lesson.updated) {
			phase = next;
			index = phaseNodes[next].indexOf(node);
		}
		selectColumn(node.stage, { node, backward, optimizer });
	}
	$: applied = phase >= 3 && lesson.updated;

	function selectPosition(index: number) {
		playing = false;
		probe?.close();
		onPosition(index);
	}
</script>

<ColumnDialog
	bind:this={columnDialog}
	{applied}
	{stages}
	{lesson}
	{position}
	step={snapshot.viewedStep}
/>
<SignalProbe
	bind:activeWeight
	bind:this={probe}
	{lesson}
	frames={positions}
	{position}
	{applied}
	onDetail={inspectSignal}
/>
<DiagramViewport currentKey={phase + '-' + current.id} onViewChange={() => probe?.close()}>
	<svelte:fragment slot="controls">
		<StepPlayback
			bind:index
			bind:phase
			bind:playing
			{position}
			positionCount={positions.length}
			{onPosition}
			{busy}
			updated={lesson.updated}
		/>
		<button
			class="chart-toggle"
			type="button"
			aria-expanded={chartOpen}
			aria-controls="signal-chart"
			on:click={() => (chartOpen = !chartOpen)}>{$t('Графики')}</button
		>
	</svelte:fragment>
	<svelte:fragment slot="charts">
		{#if chartOpen}
			<SignalChart node={current} {phase} {position} {lesson} />
		{/if}
	</svelte:fragment>
	<div
		class="board"
		style:--circuit-width={circuitWidth + 'px'}
		data-phase={phase}
		class:playing
		aria-label={$t('Единая схема предсказания и обучения')}
	>
		<div class="block-frame" aria-hidden="true"></div>
		<div class="corpus-heading">
			<button
				class="column-title"
				type="button"
				aria-haspopup="dialog"
				on:click={() => selectColumn(0)}>{$t('Учебные слова')}</button
			><small>{words.length} {$t('в корпусе')}</small>
		</div>
		<div class="columns architecture">
			<span class="input-group">{$t('Подготовка входа')}</span>
			<strong class="block-group"
				><GlossaryTerm term="block">{$t('Блок трансформера')}</GlossaryTerm></strong
			>
			<span>{$t('Выход модели')}</span>
		</div>
		<div class="ribbon-cell">
			<WordRibbon {lesson} {position} {phase} {probe} onPosition={selectPosition} />
		</div>
		<div class="drawing">
			<ModelCircuit
				{probe}
				frame={positions[position]}
				{lesson}
				{phase}
				{playing}
				{current}
				{activeWeight}
				onOptimizer={(node) => inspectBlock(node, false, true)}
				onBlock={inspectBlock}
			/>
		</div>
		<div class="source-body">
			<TrainingCorpus {lesson} {busy} {onWord} />
		</div>
	</div>
</DiagramViewport>

<style>
	.chart-toggle {
		font: inherit;
		border: 1px solid #a9bfb2;
		border-radius: 0.3rem;
		padding: 0.23rem 0.5rem;
		color: #254839;
	}
	.chart-toggle[aria-expanded='true'] {
		background: #eff6f2;
	}
	.board {
		display: grid;
		grid-template-columns: 8.5rem max-content var(--circuit-width);
		align-items: start;
		isolation: isolate;
	}
	.architecture {
		grid-area: 1/3;
		display: grid;
		grid-template-columns: 500px 1725px 1fr;
		text-align: center;
		font-size: 0.78rem;
		color: #526158;
	}
	.architecture > * {
		padding: 0.35rem 0.1rem;
	}
	.block-group {
		background: #f1ebf6;
		color: #533777;
	}
	.block-frame {
		grid-area: 1/3/3/4;
		align-self: stretch;
		position: relative;
		pointer-events: none;
		z-index: 1;
	}
	.block-frame::after {
		content: '';
		position: absolute;
		inset: 0 auto 0 500px;
		width: 1725px;
		border: 1px solid #ccbfd5;
		border-radius: 0.35rem;
	}
	.drawing {
		grid-area: 2/3;
	}
	.ribbon-cell {
		grid-area: 2/2;
	}
	.corpus-heading {
		grid-area: 1/1;
		display: grid;
		padding: 0.25rem;
		font-size: 0.78rem;
	}
	.column-title {
		font-weight: 700;
		text-align: inherit;
	}
	.column-title:hover {
		text-decoration: underline;
	}
	.source-body {
		grid-area: 2/1;
		height: 8rem;
		margin-top: calc(82px - 4rem);
		min-width: 0;
	}
	small {
		font-size: 0.66rem;
		color: #53645b;
	}
</style>
