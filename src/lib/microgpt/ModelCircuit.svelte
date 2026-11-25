<script lang="ts">
	import { t } from '$lib/i18n';
	import {
		operations,
		connections,
		parameters,
		circuitWidth,
		circuitHeight,
		matrixY,
		type Operation,
		type Point
	} from './operationGraph';
	import type { ForwardPosition, Lesson, Weight } from './model';
	import type SignalProbe from './SignalProbe.svelte';
	import CircuitEdge from './CircuitEdge.svelte';
	import OutputBranches from './OutputBranches.svelte';
	export let frame: ForwardPosition;
	export let probe: SignalProbe;
	export let lesson: Lesson;
	export let phase: number;
	export let current: Operation;
	export let playing: boolean;
	export let activeWeight: Weight | undefined;
	export let onOptimizer: (node: Operation) => void;
	export let onBlock: (node: Operation, reverse: boolean) => void;
	const height = circuitHeight;
	const flip = (points: Point[]): Point[] =>
		points.map(([x, y]): Point => [x, height - y]).reverse();
	function parameterRoute(node: Operation, reverse: boolean): Point[] {
		return reverse
			? [
					[node.x, height - node.y - 20],
					[node.x, matrixY + 55]
				]
			: [
					[node.x, matrixY - 19],
					[node.x, node.y + 20]
				];
	}
	const mean = operations.find((n) => n.id === 'mean')!;
	const turnX = circuitWidth - 33;
	const yAt = (node: Operation, reverse: boolean) => (reverse ? height - node.y : node.y);
</script>

<svg
	class="circuit"
	viewBox={'0 0 ' + circuitWidth + ' ' + height}
	aria-label={$t('Вычислительный граф microgpt для выбранной позиции')}
>
	<defs>
		<marker
			id="arrow-forward"
			viewBox="0 0 8 8"
			refX="7"
			refY="4"
			markerWidth="6"
			markerHeight="6"
			orient="auto"><path d="M0 0L8 4L0 8z" fill="#735d87" /></marker
		>
		<marker
			id="arrow-back"
			viewBox="0 0 8 8"
			refX="7"
			refY="4"
			markerWidth="6"
			markerHeight="6"
			orient="auto"><path d="M0 0L8 4L0 8z" fill="#42785c" /></marker
		>
	</defs>
	<text class="direction" x="12" y="19"
		>{$t('Прямой проход →')}{lesson.updated
			? phase >= 3
				? $t(' · веса после обновления')
				: $t(' · веса до обновления')
			: ''}</text
	>
	<text class="direction reverse-title" x="12" y={matrixY + 103}>{$t('← Обратный проход')}</text>
	<rect class="bank-band" x="0" y={matrixY - 31} width={circuitWidth} height="93" rx="5" />
	<text class="bank-title" x="12" y={matrixY - 6}>{$t('Общие параметры')}</text>
	<text class="caption" x="12" y={matrixY + 16}>{$t('Вверх · веса для вычислений')}</text>
	<text class="caption" x="12" y={matrixY + 37}>{$t('Снизу · градиенты для Adam')}</text>
	{#each [false, true] as reverse}
		<g
			class:reverse
			class:playing
			aria-label={reverse ? $t('Обратный проход') : $t('Прямой проход')}
		>
			{#each parameters as p}
				<CircuitEdge
					{probe}
					points={parameterRoute(p.node, reverse)}
					signal={{ index: p.node.stage, reverse, weight: p.weight }}
					parameter
					highlighted={activeWeight === p.weight ||
						(current === p.node && (reverse ? phase === 2 : phase !== 2 && phase !== 3))}
					label=""
					name={(reverse ? $t('Градиент из блока к Adam · ') : $t('Вес в прямой проход · ')) +
						$t(p.label)}
				/>
			{/each}
			{#each connections as edge}
				{#if reverse ? !edge.discrete : edge.from.id !== 'target'}
					<CircuitEdge
						{probe}
						points={reverse ? flip(edge.points) : edge.points}
						signal={{ index: edge.to.stage, reverse, edge }}
						highlighted={reverse
							? phase === 2 && edge.to === current
							: phase !== 2 && phase !== 3 && edge.from === current}
						label={(reverse ? 'g ' : '') + $t(edge.label)}
						name={reverse
							? $t('Градиент · ') + $t(edge.to.name) + ' → ' + $t(edge.from.name)
							: $t('Сигнал · ') + $t(edge.from.name) + ' → ' + $t(edge.to.name)}
					/>
				{/if}
			{/each}
			{#if !reverse}
				<OutputBranches
					{probe}
					{frame}
					active={phase !== 2 && phase !== 3 ? current.id : undefined}
				/>
			{/if}
			{#each operations as node}
				{#if !reverse || node.backFormula}
					<foreignObject
						x={node.x - node.w / 2}
						y={yAt(node, reverse) - 20}
						width={node.w}
						height="40"
					>
						<button
							type="button"
							class="primitive"
							class:weighted={node.weight && node.weight === activeWeight}
							data-node={node.id}
							aria-current={current === node && phase !== 3 && reverse === (phase === 2)
								? 'step'
								: undefined}
							aria-haspopup="dialog"
							on:click={() => onBlock(node, reverse)}
						>
							<b>{reverse ? $t(node.backName) : $t(node.name)}</b><span
								>{reverse ? $t(node.backFormula) : $t(node.formula)}</span
							>
						</button>
					</foreignObject>
				{/if}
			{/each}
		</g>
	{/each}
	{#each parameters as p}
		<foreignObject x={p.node.x - 30} y={matrixY - 19} width="60" height="38">
			<button
				type="button"
				class="parameter-node"
				class:chosen={activeWeight === p.weight || current === p.node}
				data-weight={p.weight}
				aria-label={$t('Общая матрица ') + $t(p.label)}
				aria-controls="signal-probe"
				aria-expanded="false"
				on:pointerenter={(e) => {
					if (e.pointerType !== 'touch')
						probe.show(e.currentTarget, {
							index: p.node.stage,
							reverse: false,
							weight: p.weight,
							shared: true
						});
				}}
				on:pointerleave={() => probe.leave()}
				on:focus={(e) =>
					probe.show(e.currentTarget, {
						index: p.node.stage,
						reverse: false,
						weight: p.weight,
						shared: true
					})}
				on:blur={() => probe.leave()}
				on:click={(e) =>
					probe.show(
						e.currentTarget,
						{ index: p.node.stage, reverse: false, weight: p.weight, shared: true },
						true
					)}
			>
				<b>{$t(p.label)}</b><small
					>{lesson.tables[p.weight].length} × {lesson.tables[p.weight][0].length}</small
				>
			</button>
		</foreignObject>
		<CircuitEdge
			{probe}
			points={[
				[p.node.x, matrixY + 37],
				[p.node.x, matrixY + 19]
			]}
			signal={{ index: p.node.stage, reverse: true, weight: p.weight, update: true }}
			parameter
			highlighted={activeWeight === p.weight || (phase === 3 && current === p.node)}
			label=""
			name={$t('Поправка Adam · ') + $t(p.label)}
		/>
		<foreignObject x={p.node.x - 22} y={matrixY + 37} width="44" height="18">
			<button
				class="optimizer"
				aria-current={phase === 3 && current === p.node ? 'step' : undefined}
				type="button"
				aria-haspopup="dialog"
				aria-label={$t('Как Adam обновляет ') + $t(p.label)}
				on:click={() => onOptimizer(p.node)}>Adam</button
			>
		</foreignObject>
	{/each}
	<CircuitEdge
		{probe}
		points={[
			[mean.x + mean.w / 2, mean.y],
			[turnX, mean.y],
			[turnX, matrixY - 18]
		]}
		signal={{ index: 6, reverse: false, seed: true }}
		highlighted={current === mean && phase === 1}
		label="L"
		name={$t('Средняя ошибка слова')}
	/>
	<CircuitEdge
		{probe}
		points={[
			[turnX, matrixY + 18],
			[turnX, height - mean.y],
			[mean.x + mean.w / 2, height - mean.y]
		]}
		signal={{ index: 6, reverse: true, seed: true }}
		label="1"
		name={$t('Начальный градиент средней ошибки')}
	/>
	<text class="seed" x={turnX} y={matrixY + 4}>∂L/∂L = 1</text>
</svg>

<style>
	.circuit {
		display: block;
		width: 100%;
		height: auto;
	}
	.direction {
		font-size: 14px;
		font-weight: 700;
		fill: #634480;
	}
	.reverse-title {
		fill: #305c42;
	}
	.bank-band {
		fill: #eef3ed;
		stroke: #d6e2d5;
	}
	.bank-title {
		font-size: 17px;
		font-weight: 700;
		fill: #264c39;
	}
	.caption {
		font-size: 12px;
		fill: #435a4c;
	}
	.seed {
		font-size: 11px;
		font-weight: 650;
		fill: #315c41;
	}
	.optimizer {
		display: block;
		width: 100%;
		height: 100%;
		border: 1px solid #92ad98;
		border-radius: 4px;
		background: white;
		color: #315c41;
		font-size: 11px;
		line-height: 1;
		font-weight: 650;
	}
	.seed {
		text-anchor: middle;
	}
	.primitive,
	.parameter-node {
		display: flex;
		width: 100%;
		height: 100%;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		line-height: 1.1;
		border: 1.5px solid #ad9aba;
		border-radius: 3px;
		background: #fbf9fd;
		color: #4c345d;
	}
	.primitive b,
	.parameter-node b {
		font-size: 13px;
	}
	.primitive span {
		font-size: 11px;
	}
	.reverse .primitive {
		border-color: #94b09b;
		color: #315540;
		background: #f8fbf8;
	}
	.parameter-node {
		border: 1.8px solid #8ba28c;
		background: white;
		color: #294a34;
	}
	.parameter-node small {
		font-size: 10px;
	}
	.primitive:hover,
	.primitive:focus-visible,
	.primitive.weighted,
	.parameter-node.chosen,
	.parameter-node:focus-visible {
		border: 2.5px solid currentColor;
	}
	button[aria-current='step'] {
		background: #fff1bc;
		border: 3px solid #966500;
		box-shadow: inset 0 0 0 1px #fff;
		color: #412d08;
	}
	.reverse .primitive[aria-current='step'] {
		background: #d9f4e3;
		border-color: #286347;
		color: #183e2a;
	}
	@media (prefers-reduced-motion: no-preference) {
		.playing :global(.edge.highlighted .line) {
			stroke-dasharray: 7 2;
			animation: flow 0.7s linear infinite;
		}
		@keyframes flow {
			to {
				stroke-dashoffset: -18;
			}
		}
	}
</style>
