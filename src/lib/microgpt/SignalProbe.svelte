<script lang="ts">
	import { t } from '$lib/i18n';
	import { onDestroy, onMount, tick } from 'svelte';
	import SignalTables from './SignalTables.svelte';
	import { signalTables, type Signal } from './signals';
	import type { ForwardPosition, Lesson } from './model';
	export let lesson: Lesson;
	export let frames: ForwardPosition[];
	export let applied: boolean;
	export let position: number;
	export let onDetail: (s: Signal) => void;

	let panel: HTMLElement;
	let anchor: HTMLButtonElement | SVGPathElement | undefined;
	export let activeWeight: import('./model').Weight | undefined = undefined;
	let point: [number, number] | undefined;
	let moment: 'before' | 'gradient' | 'after' | 'delta' = 'before';
	$: moments = [
		{ key: 'before', name: $t('До шага') },
		{ key: 'gradient', name: $t('Градиент') },
		{ key: 'delta', name: $t('Поправка') },
		{ key: 'after', name: $t('После Adam') }
	] as const;
	let signal: Signal | undefined;
	let pinned = false;
	let timer: ReturnType<typeof setTimeout>;
	export function keep() {
		clearTimeout(timer);
	}
	export function leave() {
		keep();
		if (!pinned) timer = setTimeout(close, 220);
	}
	export function close() {
		keep();
		if (panel?.matches(':popover-open')) panel.hidePopover();
		anchor?.setAttribute('aria-expanded', 'false');
		anchor = undefined;
		signal = undefined;
		pinned = false;
	}
	export async function show(
		button: HTMLButtonElement | SVGPathElement,
		next: Signal,
		pin = false,
		pointer?: [number, number]
	) {
		keep();
		if (pinned && !pin) return;
		if (pinned && anchor === button && pin) {
			close();
			return;
		}
		anchor?.setAttribute('aria-expanded', 'false');
		anchor = button;
		signal = next;
		point = pointer;
		moment = applied ? 'after' : 'before';
		pinned = pin;
		button.setAttribute('aria-expanded', 'true');
		await tick();
		if (button !== anchor) return;
		panel.showPopover();
		panel.scrollTop = 0;
		if (pin) panel.focus({ preventScroll: true });
		reposition();
	}
	export function reposition() {
		if (!anchor || !panel?.matches(':popover-open')) return;
		const r = anchor.getBoundingClientRect();
		const clip = anchor.closest('.scroll')?.getBoundingClientRect();
		if (
			r.bottom < 0 ||
			r.top > innerHeight ||
			(clip && (r.right <= clip.left || r.left >= clip.right))
		) {
			close();
			return;
		}
		const box = panel.getBoundingClientRect();
		const viewportWidth = document.documentElement.clientWidth;
		const above = r.top,
			below = innerHeight - r.bottom;
		const top = point
			? point[1] + box.height + 12 < innerHeight
				? point[1] + 8
				: point[1] - box.height - 8
			: below >= box.height || below >= above
				? r.bottom
				: r.top - box.height;
		panel.style.left =
			Math.max(
				6,
				Math.min(
					viewportWidth - box.width - 6,
					point ? point[0] - box.width / 2 : r.left + (r.width - box.width) / 2
				)
			) + 'px';
		panel.style.top = Math.max(6, Math.min(innerHeight - box.height - 6, top)) + 'px';
	}
	function outside(e: PointerEvent) {
		if (anchor && !anchor.contains(e.target as Node) && !panel.contains(e.target as Node)) close();
	}
	function escape(e: KeyboardEvent) {
		if (e.key === 'Escape' && anchor) {
			const trigger = anchor;
			trigger.focus({ preventScroll: true });
			close();
		}
	}
	function detail() {
		if (signal) {
			const selected = signal;
			close();
			onDetail(selected);
		}
	}
	$: activeWeight = signal?.weight;
	$: tables = signal
		? signalTables(
				signal,
				lesson,
				frames,
				position,
				applied,
				$t,
				signal.shared ? moment : undefined
			)
		: [];
	onMount(() => {
		const observer = new ResizeObserver(reposition);
		observer.observe(panel);
		return () => observer.disconnect();
	});
	onDestroy(() => clearTimeout(timer));
</script>

<svelte:window
	on:pointerdown={outside}
	on:keydown={escape}
	on:resize={reposition}
	on:scroll={reposition}
/>
<section
	class="signal-probe"
	id="signal-probe"
	bind:this={panel}
	popover="manual"
	tabindex="-1"
	aria-label={$t('Значения на связи')}
	on:pointerenter={keep}
	on:pointerleave={leave}
	on:focusin={keep}
	on:focusout={leave}
>
	{#if signal}
		<header>
			<strong
				>{signal.shared
					? $t('Общая матрица весов')
					: signal.update
						? $t('Обновление весов')
						: signal.reverse
							? $t('Обратный проход')
							: $t('Прямой проход')}</strong
			><span
				>«{lesson.word}{$t('» · позиция')}
				{position} · {signal.shared
					? $t('параметры выбранного шага')
					: signal.update
						? $t('поправка за шаг')
						: signal.reverse || !applied
							? $t('до обновления')
							: $t('после обновления')}</span
			>
		</header>
		{#if signal.shared}
			<p>
				{$t(
					'Каждая ячейка — один вес. Модель использует одни и те же числа для всех слов. «До шага» и «После Adam» показывают значения ячеек, а «Поправка» — на сколько изменился каждый вес.'
				)}
			</p>
			<div class="moment" role="group" aria-label={$t('Значения общей матрицы')}>
				{#each moments as choice}
					<button
						type="button"
						aria-pressed={moment === choice.key}
						disabled={(choice.key === 'after' || choice.key === 'delta') && !lesson.updated}
						on:click={() => {
							moment = choice.key;
							pinned = true;
						}}>{choice.name}</button
					>
				{/each}
			</div>
		{/if}
		<SignalTables {tables} matrix={!!signal.weight} />
		<button type="button" on:click={detail}>{$t('Открыть подробный разбор')}</button>
	{/if}
</section>

<style>
	.signal-probe {
		position: fixed;
		inset: auto;
		margin: 0;
		box-sizing: border-box;
		width: max-content;
		max-width: calc(100% - 12px);
		height: auto;
		max-height: calc(100dvh - 12px);
		overflow: auto;
		padding: 0.65rem 0.85rem;
		background: #fff;
		border: 1px solid #92a7a1;
		border-radius: 0.5rem;
		color: #20342f;
		box-shadow: 0 0.4rem 1.4rem #23392e30;
		font-size: 0.78rem;
	}
	.signal-probe:popover-open {
		display: flex;
		flex-direction: column;
	}
	header,
	p,
	.moment,
	.signal-probe > button {
		flex: none;
	}
	.signal-probe > button {
		align-self: flex-start;
	}
	p {
		max-width: 62ch;
	}
	header {
		display: grid;
	}
	header span {
		color: #596960;
	}
	.moment {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.moment button {
		padding: 0.2rem 0.4rem;
		border: 1px solid #b5c7b7;
		text-decoration: none;
	}
	.moment button[aria-pressed='true'] {
		background: #31563b;
		color: white;
	}
	button {
		margin-top: 0.5rem;
		color: #375f63;
		text-decoration: underline;
	}
</style>
