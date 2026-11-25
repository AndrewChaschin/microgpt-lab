<script lang="ts">
	import { fmt, language, t } from '$lib/i18n';
	import { corpora } from './corpora';
	import type { Lesson } from './model';

	export let lesson: Lesson;
	export let position: number;
	export let table: 'E' | 'P';
	$: frame = lesson.positions[position];
	$: token = frame.token;
	$: percent = new Intl.NumberFormat($language, { style: 'percent', maximumSignificantDigits: 3 });
	$: corpus = corpora[lesson.language];
	$: symbol = token === corpus.boundary ? $t('начало слова') : corpus.vocabulary[token];
	$: target =
		frame.target === corpus.boundary ? $t('конец слова') : corpus.vocabulary[frame.target];
	$: row = table === 'E' ? token : position;
	$: rows = lesson.tables[table].length;
	$: weights = lesson.tables[table][row];
	$: width = weights.length;
</script>

<section>
	<h3>{$t('На примере слова «{word}»', { word: lesson.word })}</h3>
	<p>
		{table === 'E'
			? $t(
					'Для «{symbol}» модель читает строку {row} таблицы E. Эта же строка будет использована при следующей встрече символа.',
					{ symbol, row }
				)
			: $t(
					'На входе «{symbol}», позиция {row}. Модель открывает строку {row} таблицы P. В другом слове на этом месте она возьмёт ту же строку.',
					{ symbol, row }
				)}
	</p>
	<p>
		{#if lesson.updated}
			{$t('Первый вес строки был равен {before}. После шага он равен {after}.', {
				before: $fmt(weights[0].before),
				after: $fmt(weights[0].after)
			})}
		{:else}
			{$t(
				'Первый вес строки равен {value}. Вместе с остальными числами строки он поступает в следующий блок.',
				{ value: $fmt(weights[0].before) }
			)}
		{/if}
	</p>
	{#if lesson.updated}
		<p>
			{$t(
				'Модель должна предсказать «{target}». До шага она давала этому ответу {before}, после обновления модели — {after}.',
				{
					target,
					before: percent.format(frame.probabilities[frame.target]),
					after: percent.format(frame.after)
				}
			)}
		</p>
	{/if}
	<details>
		<summary>{$t('Почему в строке {width} чисел?', { width })}</summary>
		<p>
			{$t(
				'Число {width} выбрано для этой модели. Каждая координата — отдельная настройка. При обучении одни сочетания помогают предсказывать, какие буквы часто встречаются рядом, другие могут оказаться полезными для предсказания конца слова. Какие различия пригодятся, зависит от учебных примеров.',
				{ width }
			)}
		</p>
		<p>
			{table === 'E'
				? $t('В E по строке на каждую букву учебного алфавита и ещё одна для границы слова.')
				: $t('В P по строке на каждую предусмотренную моделью позицию.')}
			{$t('Получается {rows} × {width} = {count} обучаемых весов в этой таблице.', {
				rows,
				width,
				count: rows * width
			})}
		</p>
		<p>
			{$t(
				'Даже при ширине 8 у каждой буквы свой номер и своя строка. Труднее другое — подобрать представления, которые передают сразу несколько полезных различий между буквами. Ширина 32 даёт больше свободы сочетать признаки, но требует больше данных, чтобы отличить закономерность от случайного совпадения. Проверить пользу такой ширины можно по прогнозам на незнакомых словах.'
			)}
		</p>
	</details>
</section>

<style>
	section {
		margin-block: 0.8rem;
		padding: 0.75rem 0.9rem;
		border-left: 3px solid #8aa89a;
		background: #f3f7f4;
		font-size: 0.88rem;
		line-height: 1.55;
	}
	h3,
	summary {
		font-weight: 650;
	}
	p,
	details {
		margin-top: 0.4rem;
	}
	summary {
		cursor: pointer;
	}
</style>
