<script lang="ts">
	import { t } from '$lib/i18n';
	import { onDestroy } from 'svelte';
	import { blockName, phaseNodes } from './operationGraph';
	export let phase: number;
	export let index: number;
	export let playing: boolean;
	export let busy: boolean;
	export let updated: boolean;
	export let position: number;
	export let positionCount: number;
	export let onPosition: (index: number) => void;

	$: phases = [
		$t('Прогноз'),
		$t('Ошибка'),
		$t('Обратный проход'),
		$t('Обновление весов'),
		$t('Проверка прогноза')
	];
	$: lastPhase = updated ? 4 : 2;
	$: lastNode = phaseNodes[phase].length - 1;
	$: first = phase === 0 && index === 0 && position === 0;
	$: last = phase === lastPhase && index === lastNode;
	let timer: ReturnType<typeof setInterval>;

	function jump(nextPhase: number, nextIndex = 0) {
		playing = false;
		phase = nextPhase;
		index = nextIndex;
	}

	function advance(direction: number) {
		const next = index + direction;
		if (next >= 0 && next <= lastNode) {
			index = next;
		} else if (phase === 0 && position + direction >= 0 && position + direction < positionCount) {
			onPosition(position + direction);
			index = direction > 0 ? 0 : lastNode;
		} else {
			phase += direction;
			index = direction > 0 ? 0 : phaseNodes[phase].length - 1;
		}
	}

	function manual(direction: number) {
		playing = false;
		advance(direction);
	}
	function toggle() {
		if (!playing && last) {
			jump(0);
			onPosition(0);
		}
		playing = !playing;
	}
	function autoplay(run: boolean) {
		clearInterval(timer);
		if (run) timer = setInterval(() => advance(1), 1000);
	}
	$: if ((last || busy) && playing) playing = false;
	$: autoplay(playing);
	onDestroy(() => clearInterval(timer));
</script>

<div class="tools" role="group" aria-label={$t('Пошаговый проход по схеме')}>
	<select
		aria-label={$t('Этап расчёта')}
		value={phase}
		disabled={busy}
		on:change={(e) => jump(Number(e.currentTarget.value))}
	>
		{#each phases as name, i}<option value={i} disabled={i > lastPhase}>{name}</option>{/each}
	</select>
	<button
		type="button"
		aria-label={$t('Предыдущий блок')}
		disabled={busy || first}
		on:click={() => manual(-1)}>{$t('← Назад')}</button
	>
	<select
		aria-label={$t('Текущий блок')}
		value={index}
		disabled={busy}
		on:change={(e) => jump(phase, Number(e.currentTarget.value))}
	>
		{#each phaseNodes[phase] as node, i}<option value={i}
				>{i + 1}/{phaseNodes[phase].length} · {blockName(node, phase, $t)}</option
			>{/each}
	</select>
	<button
		type="button"
		aria-label={$t('Следующий блок')}
		disabled={busy || last}
		on:click={() => manual(1)}>{$t('Далее →')}</button
	>
	<button class="play" type="button" disabled={busy} on:click={toggle}
		>{playing ? $t('Пауза') : last ? $t('Повторить показ') : $t('Воспроизвести')}</button
	>
</div>

<style>
	.tools {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem;
		min-width: 0;
	}
	button,
	select {
		font: inherit;
		background-color: white;
		border: 1px solid #a9bfb2;
		border-radius: 0.3rem;
		padding: 0.23rem 0.5rem;
		color: #254839;
	}
	select {
		max-width: 100%;
		padding-right: 1.8rem;
	}
	button:disabled {
		opacity: 0.45;
	}
	.play {
		background: #eff6f2;
	}
</style>
