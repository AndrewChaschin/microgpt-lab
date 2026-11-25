<script lang="ts">
	import type { Point } from './operationGraph';
	import type { Signal } from './signals';
	import type SignalProbe from './SignalProbe.svelte';
	export let points: Point[];
	export let signal: Signal;
	export let probe: SignalProbe;
	export let label: string;
	export let name: string;
	export let highlighted = false;
	export let parameter = false;
	export let labelAt: Point | undefined = undefined;
	$: d = points.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join(' ');
	$: midpoint = labelAt ?? longestSegment(points);
	function longestSegment(path: Point[]): Point {
		let best = 0,
			mid: Point = path[0];
		for (let i = 1; i < path.length; i++) {
			const a = path[i - 1],
				b = path[i],
				len = Math.hypot(b[0] - a[0], b[1] - a[1]);
			if (len > best) {
				best = len;
				mid = [
					(a[0] + b[0]) / 2 + (a[0] === b[0] ? 8 : 0),
					(a[1] + b[1]) / 2 - (a[0] === b[0] ? 0 : 4)
				];
			}
		}
		return mid;
	}
</script>

<g class="edge" class:reverse={signal.reverse} class:parameter class:highlighted>
	<path class="clearance" {d} aria-hidden="true" />
	<path class="line" {d} marker-end={'url(#arrow-' + (signal.reverse ? 'back' : 'forward') + ')'} />
	{#if label}<text x={midpoint[0]} y={midpoint[1]}>{label}</text>{/if}
	<path
		class="hit"
		{d}
		role="button"
		tabindex="0"
		aria-label={name}
		aria-expanded="false"
		aria-controls="signal-probe"
		on:pointerenter={(e) => {
			if (e.pointerType !== 'touch')
				probe.show(e.currentTarget, signal, false, [e.clientX, e.clientY]);
		}}
		on:pointerleave={() => probe.leave()}
		on:focus={(e) => probe.show(e.currentTarget, signal)}
		on:blur={() => probe.leave()}
		on:click={(e) => probe.show(e.currentTarget, signal, true, [e.clientX, e.clientY])}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				probe.show(e.currentTarget, signal, true);
			}
		}}
	/>
</g>

<style>
	.edge {
		color: #735d87;
	}
	.reverse {
		color: #42785c;
	}
	.clearance {
		fill: none;
		stroke: white;
		stroke-width: 5;
		pointer-events: none;
	}
	.line {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linejoin: round;
	}
	.parameter .line {
		stroke-dasharray: 4 2;
		stroke-width: 1.2;
	}
	text {
		fill: currentColor;
		font: 11px system-ui;
		text-anchor: middle;
		paint-order: stroke;
		stroke: white;
		stroke-width: 3px;
		pointer-events: none;
	}
	.hit {
		stroke: transparent;
		stroke-width: 13;
		fill: none;
		cursor: help;
		pointer-events: stroke;
	}
	.edge:focus-within .line,
	.edge:hover .line,
	.highlighted .line {
		stroke-width: 3;
		stroke-dasharray: none;
	}
	.edge:focus-within text,
	.edge:hover text {
		font-weight: 700;
	}
</style>
