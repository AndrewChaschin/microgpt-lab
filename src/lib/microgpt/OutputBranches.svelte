<script lang="ts">
	import { language, t } from '$lib/i18n';
	import type { Corpus } from './corpora';
	import type { ForwardPosition } from './model';
	import { connections, operations, type Operation } from './operationGraph';
	import { outputResult, type OutputKind } from './signals';
	import CircuitEdge from './CircuitEdge.svelte';
	import type SignalProbe from './SignalProbe.svelte';

	export let active: Operation['id'] | undefined;
	export let corpus: Corpus;
	export let frame: ForwardPosition;
	export let probe: SignalProbe;
	const targetToLog = connections.find((edge) => edge.from.id === 'target')!;
	const log = targetToLog.to;
	const width = 170;
	const height = 64;
	const kinds: OutputKind[] = ['argmax', 'target'];
	$: branches = kinds.map((kind) => ({
		kind,
		node: operations.find((node) => node.id === kind)!,
		label: kind === 'argmax' ? $t('Прогноз модели') : $t('Цель из слова')
	}));
	$: percent = new Intl.NumberFormat($language, { style: 'percent', maximumSignificantDigits: 3 });
</script>

{#each branches as { kind, node, label }}
	{@const result = outputResult(frame, kind, corpus, $t)}
	{@const signal = { index: node.stage, reverse: false, output: kind }}
	<CircuitEdge
		{probe}
		points={[
			[node.x + node.w / 2, node.y],
			[log.x - width / 2, node.y]
		]}
		highlighted={active === kind}
		{signal}
		label=""
		name={$t('Сигнал · ') + $t(node.name) + ' → ' + label}
	/>
	<foreignObject x={log.x - width / 2} y={node.y - height / 2} {width} {height}>
		<button
			type="button"
			class="result-card"
			class:receiving={active === kind}
			class:target={kind === 'target'}
			data-result={kind}
			aria-expanded="false"
			aria-controls="signal-probe"
			on:pointerenter={(e) => {
				if (e.pointerType !== 'touch') probe.show(e.currentTarget, signal);
			}}
			on:pointerleave={() => probe.leave()}
			on:focus={(e) => probe.show(e.currentTarget, signal)}
			on:blur={() => probe.leave()}
			on:click={(e) => probe.show(e.currentTarget, signal, true)}
		>
			<b>{label}</b>
			<span><strong>{result.symbol}</strong> {percent.format(result.probability)}</span>
		</button>
	</foreignObject>
{/each}
<CircuitEdge
	{probe}
	points={[
		[log.x, targetToLog.from.y + height / 2],
		[log.x, log.y - 20]
	]}
	signal={{ index: log.stage, reverse: false, edge: targetToLog }}
	highlighted={active === 'target'}
	label="p*"
	name={$t('Сигнал · вероятность цели → Логарифм')}
/>

<style>
	.result-card {
		display: grid;
		place-content: center;
		gap: 3px;
		width: 100%;
		height: 100%;
		border: 1.5px solid #88739a;
		border-radius: 8px;
		background: #f0eaf7;
		color: #4b345f;
		text-align: center;
		font-size: 14px;
		line-height: 1.25;
		font-variant-numeric: tabular-nums;
	}
	.result-card.target {
		border-color: #b3996c;
		background: #fcf5e8;
		color: #674c27;
	}
	.result-card span {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 10px;
	}
	.result-card strong {
		font-size: 18px;
	}
	.result-card.receiving,
	.result-card:hover,
	.result-card:focus-visible {
		border: 2px solid currentColor;
	}
</style>
