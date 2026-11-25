<script lang="ts">
	import { language, t } from '$lib/i18n';
	import { onMount } from 'svelte';
	import { corpusStopping, words } from './model';
	import type {
		CorpusProgress,
		Snapshot,
		TrainingRequest,
		TrainingResponse
	} from './training.worker';
	import Flow from './Flow.svelte';
	import Validation from './Validation.svelte';

	let worker: Worker | undefined;
	let snapshot: Snapshot | undefined;
	let position = 3;
	let busy = true;
	let trainingCorpus = false;
	let progress: CorpusProgress | undefined;
	let phase = 0;
	let error = '';

	$: number = new Intl.NumberFormat($language, { maximumFractionDigits: 5 });
	$: stoppingHint = $t(
		'В каждом цикле модель перемешивает слова. Для выбора весов учитывается средняя ошибка по {count} учебным словам. Если за {patience} циклов средняя ошибка не уменьшилась хотя бы на {improvement}, сохраняются лучшие веса.',
		{
			count: words.length,
			patience: corpusStopping.patience,
			improvement: number.format(corpusStopping.minImprovement)
		}
	);
	$: integer = new Intl.NumberFormat($language);
	$: lessonSteps = [
		$t('Токены'),
		$t('Эмбеддинги'),
		$t('Запрос, ключ, значение'),
		$t('Самовнимание'),
		'MLP',
		$t('Вероятности')
	];

	$: lesson = snapshot?.lesson;
	$: activePosition = Math.min(position, (lesson?.positions.length ?? 1) - 1);
	$: frame = lesson?.positions[activePosition];
	$: afterStep = Boolean(lesson?.updated && phase >= 3);
	$: positions = (afterStep && lesson?.afterPositions) || lesson?.positions || [];
	$: recent = snapshot?.history ?? [];
	$: peakLoss = Math.max(...recent.map((entry) => entry.loss), 0.0001);
	function inspectStep(step: number) {
		send({ type: 'inspect', step });
	}

	function reset() {
		if (worker) {
			worker.onmessage = null;
			worker.onerror = null;
			worker.terminate();
		}
		position = 3;
		error = '';
		progress = undefined;
		snapshot = undefined;
		trainingCorpus = false;
		busy = true;
		try {
			worker = new Worker(new URL('./training.worker.ts', import.meta.url), { type: 'module' });
			worker.onmessage = ({ data }: MessageEvent<TrainingResponse>) => {
				if (data.type === 'corpus-progress') {
					progress = data.progress;
					if (data.snapshot) {
						snapshot = data.snapshot;
						phase = 0;
					}
					return;
				}
				if (data.type === 'progress') return;
				busy = false;
				trainingCorpus = false;
				progress = undefined;
				if (data.snapshot) {
					snapshot = data.snapshot;
					phase = snapshot.lesson.updated ? 4 : 0;
				}
				if (data.type === 'error') error = data.message;
			};
			worker.onerror = () => {
				busy = false;
				trainingCorpus = false;
				progress = undefined;
				error = 'Фоновый поток завершился. Нажмите «Сбросить», чтобы запустить модель заново.';
			};
			worker.postMessage({ type: 'reset' });
		} catch {
			busy = false;
			error = 'Браузер не смог запустить фоновые вычисления.';
		}
	}

	onMount(() => {
		reset();
		return () => worker?.terminate();
	});

	function send(message: TrainingRequest) {
		if (!worker || busy) return;
		error = '';
		busy = true;
		trainingCorpus = message.type === 'train-corpus';
		worker.postMessage(message);
	}
</script>

<main id="top">
	<section class="scheme" id="scheme" aria-labelledby="scheme-title">
		<div class="scheme-header">
			<h1 id="scheme-title">{$t('microgpt · Предсказание и обучение')}</h1>
			<div class="train-actions">
				<select class="language" aria-label={$t('Язык интерфейса')} bind:value={$language}>
					<option value="ru" lang="ru">Русский</option>
					<option value="en" lang="en">English</option>
				</select>
				<button
					class="primary"
					type="button"
					disabled={busy || !snapshot}
					title={stoppingHint}
					on:click={() => send({ type: 'train-corpus' })}>{$t('Обучить')}</button
				>
				{#if lesson}
					<button
						type="button"
						class="train-word"
						disabled={busy}
						on:click={() => send({ type: 'train', word: lesson.word, steps: 1 })}
						>{$t('Обучить на слове «{word}»', { word: lesson.word })}</button
					>
				{/if}
				<button type="button" disabled={busy && !snapshot} on:click={reset}>{$t('Сбросить')}</button
				>
			</div>
		</div>

		{#if error}
			<p class="error" role="alert">{$t(error)}</p>
		{/if}

		{#if snapshot && lesson && frame}
			<div class="status-line">
				<span
					id="training-status"
					role="status"
					title={trainingCorpus || snapshot.corpusResult ? stoppingHint : undefined}
				>
					{#if trainingCorpus && progress}
						{$t('Цикл {cycle} · {done} из {total} слов', {
							cycle: progress.cycle,
							done: progress.completed,
							total: words.length
						})}
					{:else if trainingCorpus}
						{$t('Вычисляем начальную ошибку по всем {count} словам…', { count: words.length })}
					{:else if snapshot.corpusResult}
						{$t('Обучение завершено · циклов {count}.', { count: snapshot.corpusResult.cycles })}
						{snapshot.corpusResult.bestCycle
							? $t('Лучший цикл ') + snapshot.corpusResult.bestCycle
							: $t('Лучший результат до начала циклов')}
					{:else}
						{$t('Выполнено шагов')} <strong>{integer.format(snapshot.step)}</strong>
					{/if}
				</span>
				{#if trainingCorpus && progress}
					<progress
						aria-label={$t('Слов в текущем цикле')}
						value={progress.completed}
						max={words.length}
					></progress>
				{/if}
			</div>
			<Validation {snapshot} />
			{#if recent.length}
				<div class="timeline">
					<label
						>{$t('Шаг на схеме')}
						<select
							aria-label={$t('Шаг на схеме')}
							value={snapshot.viewedStep}
							disabled={busy}
							on:change={(event) => inspectStep(Number(event.currentTarget.value))}
						>
							{#if !snapshot.viewedStep}<option value={0} disabled>{$t('Текущие веса')}</option
								>{/if}
							{#each recent as entry}<option value={entry.step}>{entry.step} · {entry.word}</option
								>{/each}
						</select>
					</label>
					<div
						class="history-bars"
						role="group"
						aria-label={$t('Ошибка слова до обновления по шагам')}
					>
						{#each recent as entry}
							<button
								type="button"
								disabled={busy}
								aria-pressed={snapshot.viewedStep === entry.step}
								aria-label={$t('Шаг ') +
									entry.step +
									', ' +
									entry.word +
									$t(', ошибка ') +
									number.format(entry.loss)}
								title={$t('Шаг ') +
									entry.step +
									' · ' +
									entry.word +
									' · ' +
									number.format(entry.loss)}
								on:click={() => inspectStep(entry.step)}
								><i style:height={(100 * entry.loss) / peakLoss + '%'}></i></button
							>
						{/each}
					</div>
				</div>
			{/if}
			<Flow
				{positions}
				bind:phase
				{snapshot}
				{busy}
				stages={lessonSteps}
				position={activePosition}
				onWord={(index) => send({ type: 'word', index })}
				onPosition={(p) => (position = p)}
			/>
		{:else if !error}
			<p class="loading" role="status">{$t('Подготавливаем microgpt…')}</p>
		{/if}
	</section>
</main>

<style>
	.language {
		border: 1px solid #b1c7ba;
		border-radius: 0.3rem;
		padding: 0.25rem 0.4rem;
		background: white;
		color: inherit;
		font: inherit;
	}
	.timeline {
		padding: 0.55rem 1rem;
		border-bottom: 1px solid #dce6df;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem 0.8rem;
	}
	.timeline label {
		font-size: 0.85rem;
		font-weight: 650;
	}
	.timeline select {
		background: white;
		margin-left: 0.3rem;
		border: 1px solid #b1c7ba;
		border-radius: 0.3rem;
		padding: 0.2rem 0.4rem;
	}
	.history-bars {
		display: flex;
		align-items: stretch;
		flex: 1 1 14rem;
		min-width: 0;
		height: 2rem;
		gap: 1px;
	}
	.history-bars button {
		flex: 1;
		max-width: 2rem;
		min-width: 0;
		display: flex;
		align-items: flex-end;
		border-bottom: 1px solid #a8b9ad;
	}
	.history-bars i {
		display: block;
		width: 100%;
		background: #91b4a1;
		min-height: 1px;
	}
	.history-bars button[aria-pressed='true'] i {
		background: #554076;
	}
	main {
		width: calc(100% - 2.5rem);
		margin-inline: auto;
		padding-block: 1rem;
		color: #192b22;
	}
	h1 {
		color: #14291e;
		font-size: clamp(1.05rem, 2.1vw, 1.4rem);
		font-weight: 720;
	}
	.status-line {
		color: #475b4f;
		font-size: 0.8rem;
	}
	.scheme {
		border: 1px solid #dfe8e1;
		border-radius: 0.85rem;
		background: #fff;
		box-shadow: 0 0.28rem 1rem #203a2c0a;
		scroll-margin-top: 0.75rem;
	}
	.scheme-header,
	.status-line {
		padding-inline: 1.25rem;
	}
	.scheme-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding-block: 0.85rem;
		border-bottom: 1px solid #e5ece7;
	}
	.train-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.36rem;
	}
	button {
		padding: 0.4rem 0.68rem;
		border: 1px solid #cddbd3;
		border-radius: 0.38rem;
		background: #fff;
		color: #254839;
		font-size: 0.76rem;
		font-weight: 650;
		line-height: 1.25;
	}
	.timeline .history-bars button {
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		border-bottom: 1px solid #a8b9ad;
	}

	button.primary {
		border-color: #1c5140;
		background: #1c5140;
		color: #fff;
	}
	button:not(:disabled):hover {
		box-shadow: inset 0 0 0 1px #67a78d;
	}
	button:disabled {
		cursor: wait;
		opacity: 0.55;
	}
	button:focus-visible,
	select:focus-visible {
		outline: 2px solid #296f55;
		outline-offset: 2px;
	}
	.status-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.2rem 1.25rem;
		padding-block: 0.58rem;
		background: #f5f8f6;
	}
	progress {
		width: min(8rem, 100%);
		height: 0.55rem;
		accent-color: #327653;
	}
	.loading,
	.scheme > .error {
		padding: 1rem;
	}
	.error {
		color: #a83232 !important;
	}
	@media (max-width: 500px) {
		main {
			width: calc(100% - 1.15rem);
		}
	}
</style>
