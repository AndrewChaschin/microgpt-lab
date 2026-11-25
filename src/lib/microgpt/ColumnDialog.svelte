<script lang="ts">
	import { t } from '$lib/i18n';
	import { tick } from 'svelte';
	import { stageWeights, type Weight, type Lesson } from './model';
	import { corpora } from './corpora';
	import PositionSumExample from './PositionSumExample.svelte';
	import EmbeddingExample from './EmbeddingExample.svelte';
	import OperationGuide from './OperationGuide.svelte';
	import type { Operation } from './operationGraph';
	import TransitionGradient from './TransitionGradient.svelte';
	import TransitionMath from './TransitionMath.svelte';
	import { transitions } from './transitions';
	import ColumnValues from './ColumnValues.svelte';

	export let lesson: Lesson;
	export let applied: boolean;
	let transition = false;
	let primitive: Operation | undefined;
	let optimizer = false;
	let afterMath = false;
	export let position: number;
	export let step: number;
	export let stages: string[];

	let dialog: HTMLDialogElement;
	let title: HTMLHeadingElement;
	let visible = false;
	let stage = 0;
	let matrix: Weight = 'E';
	let matrixRow = 0;

	let backward = false;
	let showWeights = false;
	export async function open(
		index: number,
		options: {
			backward?: boolean;
			weight?: Weight;
			transition?: boolean;
			node?: Operation;
			optimizer?: boolean;
		} = {}
	) {
		const { weight } = options;
		primitive = options.node;
		optimizer = Boolean(options.optimizer);
		backward = Boolean(options.backward);
		transition = Boolean(options.transition);
		afterMath = applied;
		showWeights = Boolean(weight);
		stage = index;
		visible = true;
		await tick();
		matrix = weight ?? stageWeights[index]?.[0] ?? 'E';
		matrixRow = index === 5 ? before.target : 0;
		if (!dialog.open) dialog.showModal();
		title.focus({ preventScroll: true });
		dialog.scrollTop = 0;
	}
	$: ({ boundary, vocabulary } = corpora[lesson.language]);
	$: symbol = (id: number, end = false) =>
		id === boundary ? (end ? $t('конец') : $t('начало')) : vocabulary[id];
	$: before = lesson.positions[position];
	$: after = lesson.afterPositions?.[position];
	type VectorKey =
		| 'embedding'
		| 'position'
		| 'combined'
		| 'query'
		| 'key'
		| 'value'
		| 'attended'
		| 'activated'
		| 'hidden'
		| 'probabilities';
	$: vector = (name: string, key: VectorKey) => ({
		name,
		before: before[key],
		after: after?.[key]
	});
	$: matrixValues = lesson.tables[matrix][matrixRow];
</script>

<dialog
	bind:this={dialog}
	closedby="any"
	class:operation={Boolean(primitive)}
	on:close={(event) => {
		if (!event.currentTarget.open) visible = false;
	}}
	aria-labelledby="column-title"
>
	{#if visible}
		<header>
			<form method="dialog"><button aria-label={$t('Закрыть пояснение')}>×</button></form>
			{#if primitive}<p>
					{optimizer
						? $t('Обновление весов')
						: backward
							? $t('Обратный проход')
							: $t('Прямой проход')} · {stages[stage] ?? $t('Сравнение с целью')}
				</p>
			{:else}<p>«{lesson.word}{$t('» · позиция')} {position} · {symbol(before.token)}</p>{/if}
			<h2 bind:this={title} tabindex="-1" id="column-title">
				{optimizer
					? $t('Обновление матрицы · Adam')
					: primitive
						? backward
							? $t(primitive.backName)
							: $t(primitive.name)
						: transition
							? $t(transitions[stage].name)
							: stage === 1 && !backward
								? $t('Веса эмбеддингов')
								: (stages[stage] ?? $t('Сравнение с целью'))}
				{#if backward && !primitive}
					{$t('· обратный проход')}{/if}
			</h2>
		</header>
		{#if primitive}
			<OperationGuide id={optimizer ? 'adam' : primitive.id} {backward}>
				{#if !optimizer && !backward && (primitive.id === 'embedding' || primitive.id === 'position')}
					<EmbeddingExample {lesson} {position} table={primitive.id === 'embedding' ? 'E' : 'P'} />
				{:else if primitive.id === 'combined' && !backward}
					<PositionSumExample {lesson} {applied} />
				{/if}
			</OperationGuide>
		{:else if transition}
			<p>
				{stage === 0 ? $t('Учебные слова') : stages[stage - 1]}
				{backward ? '←' : '→'}
				{stages[stage] ?? $t('Сравнение с целью')}
			</p>
			{#if after && stage > 0 && !backward}
				<div class="moment" role="group" aria-label={$t('Состояние модели')}>
					{#each [false, true] as updated}
						<button
							type="button"
							aria-pressed={afterMath === updated}
							on:click={() => (afterMath = updated)}
							>{updated ? $t('После шага') : $t('До шага')}</button
						>
					{/each}
				</div>
			{/if}
			{#if backward}<TransitionGradient
					index={stage}
					{lesson}
					{position}
					j={0}
				/>{:else}<TransitionMath
					index={stage}
					{lesson}
					{position}
					coordinate={0}
					after={afterMath}
				/>{/if}
		{:else if stage === 0}
			<p class="guide">
				{$t(
					'Каждая буква получает ID из словаря. Модель читает строку слева направо. Цель в каждой позиции — следующий символ слова. На границах один служебный ID обозначает начало или конец.'
				)}
			</p>
			<table>
				<thead
					><tr
						><th>{$t('Позиция')}</th><th>{$t('Вход')}</th><th>ID</th><th>{$t('Цель')}</th><th
							>{$t('ID цели')}</th
						></tr
					></thead
				>
				<tbody
					>{#each lesson.positions as f, i}<tr class:marked={position === i}
							><th scope="row">{i}</th><td>{symbol(f.token)}</td><td>{f.token}</td><td
								>{symbol(f.target, true)}</td
							><td>{f.target}</td></tr
						>{/each}</tbody
				>
			</table>
		{:else if backward}
			<p class="guide">
				{$t(
					'Градиент показывает, как изменится средняя ошибка слова при малом изменении выбранного значения. Модель вычисляет его до обновления весов.'
				)}
			</p>
			{#if stage === 1}
				<ColumnValues
					columns={[{ name: $t('Градиент E + P'), before: before.backward.combined }]}
				/>
			{:else if stage === 2}
				<ColumnValues
					columns={[
						{ name: $t('Градиент Q'), before: before.backward.query },
						{ name: $t('Градиент K'), before: before.backward.key },
						{ name: $t('Градиент V'), before: before.backward.value }
					]}
				/>
			{:else if stage === 3 || stage === 4}
				<ColumnValues
					columns={[
						{
							name: $t('Градиент выхода'),
							before: stage === 3 ? before.backward.attended : before.backward.hidden
						}
					]}
				/>
			{:else}
				<ColumnValues
					firstHeading={$t('Символ')}
					rowLabels={vocabulary.map((_, id) => symbol(id, true))}
					columns={[{ name: $t('Градиент оценки до softmax'), before: before.backward.logits }]}
					marked={before.target}
				/>
			{/if}
		{:else}
			{#if stage === 1}
				<EmbeddingExample {lesson} {position} table={matrix === 'P' ? 'P' : 'E'} />
				<p class="guide">
					{$t('Каждая строка показывает одну координату. E[')}{before.token}{$t(
						'] — вектор символа, P['
					)}{position}{$t('] — вектор позиции. Их сумма поступает в трансформер.')}
				</p>
			{:else if stage === 2}
				<p class="guide">
					{$t(
						'Из одного входного вектора модель вычисляет три вектора. Запрос Q сравнивается с ключами K доступных позиций, чтобы определить, какую долю каждого значения V использовать.'
					)}
				</p>
			{:else if stage === 3}
				<p class="guide">
					{$t(
						'Каждая голова распределяет внимание между текущей и предыдущими позициями. В каждом столбце доли в сумме дают 100 % до округления.'
					)}
				</p>
			{:else if stage === 4}
				<p class="guide">
					{$t('Первый слой расширяет вектор до')}
					{before.activated.length}
					{$t(
						'координат. Функция ReLU заменяет отрицательные значения нулями. Второй слой возвращает'
					)}
					{before.hidden.length}
					{$t('координат, и модель прибавляет результат к входу блока.')}
				</p>
			{:else if stage === 5}
				<p class="guide">
					{$t('После «')}{lesson.word.slice(0, position) || $t('начало слова')}{$t(
						'» модель вычисляет вероятность каждого символа словаря. Выделена цель из учебного слова — «'
					)}{symbol(before.target, true)}».
				</p>
			{:else}
				<p class="guide">
					{$t(
						'Для каждой позиции модель берёт вероятность правильного символа p и вычисляет ошибку −ln(p). Ошибка слова — среднее по всем позициям.'
					)}
				</p>
			{/if}
			{#if after}<p class="moment">
					{$t('Шаг')}
					{step}{$t('. В каждой числовой ячейке верхнее значение — до обновления,')}
					<strong>{$t('нижнее — после')}</strong>.
				</p>
			{:else}<p class="moment">{$t('Значения до шага обучения.')}</p>{/if}
			{#if stage === 1}
				<ColumnValues
					columns={[
						vector('E[' + before.token + ']', 'embedding'),
						vector('P[' + position + ']', 'position'),
						vector('E + P', 'combined')
					]}
				/>
			{:else if stage === 2}
				<ColumnValues
					columns={[
						vector($t('Запрос Q'), 'query'),
						vector($t('Ключ K'), 'key'),
						vector($t('Значение V'), 'value')
					]}
				/>
			{:else if stage === 3}
				<ColumnValues
					firstHeading={$t('Позиция · вход')}
					percent
					rowLabels={lesson.positions.map((f, i) => i + ' · ' + symbol(f.token))}
					columns={before.attention.map((shares, h) => ({
						name: $t('Голова ') + (h + 1),
						before: shares,
						after: after?.attention[h]
					}))}
					marked={position}
				/>
				<ColumnValues
					caption={$t('Выход блока внимания')}
					columns={[vector($t('Значение'), 'attended')]}
				/>
			{:else if stage === 4}
				<ColumnValues
					caption={$t('Выход MLP с прибавленным входом')}
					columns={[vector($t('Значение'), 'hidden')]}
				/>
				<ColumnValues
					caption={$t('Промежуточные значения')}
					columns={[vector($t('После ReLU'), 'activated')]}
				/>
			{:else if stage === 5}
				<ColumnValues
					firstHeading={$t('ID · символ')}
					rowLabels={vocabulary.map((_, id) => id + ' · ' + symbol(id, true))}
					percent
					columns={[vector($t('Вероятность'), 'probabilities')]}
					marked={before.target}
				/>
			{:else}
				<ColumnValues
					firstHeading={$t('Позиция · цель')}
					rowLabels={lesson.positions.map((f, i) => i + ' · ' + symbol(f.target, true))}
					columns={[
						{
							name: $t('Вероятность p'),
							before: lesson.positions.map((f) => f.probabilities[f.target]),
							after: lesson.afterPositions?.map((f) => f.probabilities[f.target])
						},
						{
							name: $t('Ошибка'),
							before: lesson.positions.map((f) => -Math.log(f.probabilities[f.target])),
							after: lesson.afterPositions?.map((f) => -Math.log(f.probabilities[f.target]))
						}
					]}
					marked={position}
				/>
				<ColumnValues
					firstHeading=" "
					rowLabels={[$t('Слово целиком')]}
					columns={[
						{
							name: $t('Средняя ошибка'),
							before: [lesson.loss],
							after: after ? [lesson.lossAfter] : undefined
						}
					]}
				/>
			{/if}
			{#if stage >= 2 && stage <= 5}
				<details open={showWeights}>
					<summary>{$t('Обучаемые веса')}</summary>
					<p>{$t('Строка матрицы задаёт одну выходную координату, столбцы — веса её входов.')}</p>
					<label
						>{$t('Матрица')}
						<select
							value={matrix}
							on:change={(e) => {
								matrix = e.currentTarget.value as Weight;
								matrixRow = 0;
							}}
						>
							{#each stageWeights[stage] as key}<option value={key}>{$t(key)}</option
								>{/each}</select
						></label
					>
					<label
						>{$t('Строка')}
						<select bind:value={matrixRow}
							>{#each lesson.tables[matrix].keys() as i}<option value={i}
									>{i}{matrix === 'Выход' ? ' · ' + symbol(i, true) : ''}</option
								>{/each}</select
						></label
					>
					<ColumnValues
						firstHeading={$t('Столбец')}
						columns={[
							{
								name: $t(matrix) + '[' + matrixRow + ', j]',
								before: matrixValues.map((v) => v.before),
								after: after ? matrixValues.map((v) => v.after) : undefined
							}
						]}
					/>
				</details>
			{/if}
		{/if}
	{/if}
</dialog>

<style>
	.moment button {
		border: 1px solid #c4d3d4;
		padding: 0.2rem 0.55rem;
	}
	.moment button[aria-pressed='true'] {
		background: #215c64;
		color: white;
	}
	dialog {
		margin: auto;
		width: min(31rem, calc(100% - 1.5rem));
		max-height: calc(100% - 1.5rem);
		overflow: auto;
		padding: 1rem;
		border: 1px solid #c8c0d2;
		border-radius: 0.6rem;
		background: white;
		color: #302e36;
	}
	dialog.operation {
		width: min(42rem, calc(100% - 1.5rem));
	}
	dialog::backdrop {
		background: rgb(26 21 36 / 45%);
	}
	header {
		display: grid;
		grid-template-columns: 1fr auto;
		column-gap: 0.8rem;
	}
	header form {
		grid-column: 2;
		grid-row: 1 / span 2;
		align-self: start;
	}
	header button {
		font-size: 1.25rem;
		padding: 0 0.6rem;
		background: #f4f0f7;
		border-radius: 0.3rem;
	}
	header p {
		font-size: 0.8rem;
		color: #63576d;
	}
	h2 {
		font-size: 1.2rem;
		font-weight: 700;
	}
	.guide,
	.moment {
		margin: 0.65rem 0;
		font-size: 0.85rem;
		line-height: 1.45;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.3rem;
		border-bottom: 1px solid #e6e2e9;
	}
	thead th,
	tr.marked {
		background: #f1ebf6;
	}
	details {
		margin-top: 0.8rem;
		border-top: 1px solid #ded8e5;
		padding-top: 0.55rem;
		font-size: 0.85rem;
	}
	summary {
		cursor: pointer;
		font-weight: 650;
	}
	details p {
		margin: 0.5rem 0;
	}
	select {
		border: 1px solid #ccc3d5;
		padding: 0.15rem 0.25rem;
		margin-right: 0.6rem;
	}
</style>
