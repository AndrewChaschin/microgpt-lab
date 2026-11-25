<script lang="ts">
	import { fmt, t } from '$lib/i18n';
	import { headWidth, type Lesson, type Weight } from './model';
	import ColumnValues from './ColumnValues.svelte';
	import DotProduct from './DotProduct.svelte';
	export let lesson: Lesson;
	export let index: number;
	export let position: number;
	export let j: number;
	$: f = lesson.positions[position];
	$: g = f.backward;
	$: column = (key: Weight, k: number) => lesson.tables[key].map((row) => row[k].before);
	$: head = Math.floor(j / headWidth);
	$: n = lesson.positions.length;
</script>

<p>
	{$t(
		'Здесь g обозначает градиент средней ошибки слова. Все числа относятся к проходу, по которому модель вычисляет поправку к весам.'
	)}
</p>
{#if index === 1}
	<p>
		{$t(
			'При сложении x = E + P производная по каждому слагаемому равна единице. Градиент x переходит к обеим выбранным строкам. Для строки E складываются вклады всех вхождений того же символа.'
		)}
	</p>
	<ColumnValues
		firstHeading={$t('Вхождение')}
		rowLabels={lesson.positions.flatMap((v, s) => (v.token === f.token ? [String(s)] : []))}
		columns={[
			{
				name: $t('Вклад в E[') + f.token + ', ' + j + ']',
				before: lesson.positions
					.filter((v) => v.token === f.token)
					.map((v) => v.backward.combined[j])
			}
		]}
	/>
	<p>
		gE[{f.token}, {j}] ≈ {$fmt(f.weights.E[j].gradient)}{$t('. Для позиции')}
		{position} gP[{position}, {j}] = gₓ[{j}] ≈ {$fmt(g.combined[j])}.
	</p>
{:else if index === 2}
	<p>
		{$t(
			'Каждая координата нормированного входа u участвует в трёх проекциях. Для обратного прохода берётся столбец j каждой матрицы и умножается на градиент её выхода. Три суммы складываются.'
		)}
	</p>
	{#each ['Q', 'K', 'V'] as name, k}<DotProduct
			name={$t('Вклад ') + name + $t(' в gu[') + j + ']'}
			weights={column(name as Weight, j)}
			input={[g.query, g.key, g.value][k]}
		/>{/each}
	<p>
		{$t('Суммарный градиент gu[')}{j}] ≈ {$fmt(g.normalized[j])}{$t(
			'. Дальше он проходит через нормировку.'
		)}
	</p>
{:else if index === 3}
	<p>
		{$t('Значение V позиции')}
		{position}
		{$t(
			'попадает в смеси этой и всех более поздних позиций. Вклад каждой смеси равен её градиенту, умноженному на долю внимания к позиции'
		)}
		{position}.
	</p>
	<ColumnValues
		firstHeading={$t('Позиция смеси')}
		rowLabels={lesson.positions.slice(position).map((_, k) => String(position + k))}
		columns={[
			{
				name: $t('Доля α'),
				before: lesson.positions.slice(position).map((v) => v.attention[head][position])
			},
			{
				name: $t('g смеси'),
				before: lesson.positions.slice(position).map((v) => v.backward.merged[j])
			},
			{
				name: $t('Вклад'),
				before: lesson.positions
					.slice(position)
					.map((v) => v.attention[head][position] * v.backward.merged[j])
			}
		]}
	/>
	<p>{$t('Сумма вкладов даёт gV[')}{j}] ≈ {$fmt(g.value[j])}.</p>
{:else if index === 4}
	<p>
		{$t(
			'Сигнал от выхода h идёт к входу внимания a двумя путями. Сложение передаёт gₕ напрямую. Другой путь идёт через второй слой, ReLU, первый слой и нормировку.'
		)}
	</p>
	<DotProduct
		name={$t('Сигнал к выходу ReLU, координата ') + j}
		weights={column('MLP out', j)}
		input={g.hidden}
	/>
	<p>
		{$t('До ReLU z[')}{j}] ≈ {$fmt(f.expanded[j])}{$t('. Производная ReLU здесь равна')}
		{Number(f.expanded[j] > 0)}{$t(', поэтому сигнал к z[')}{j}{$t('] равен')}
		{$fmt(g.expanded[j])}.
	</p>
	<p>
		{$t('На входе блока оба пути складываются. gₐ[')}{j}] ≈ {$fmt(g.hidden[j])} + ({$fmt(
			g.attended[j] - g.hidden[j]
		)}) ≈ {$fmt(g.attended[j])}.
	</p>
{:else if index === 5}
	<p>
		{$t('Координата h[')}{j}{$t(
			'] участвует в оценке каждого символа. Умножаем градиент каждой оценки на соответствующий вес выходной матрицы и складываем вклады.'
		)}
	</p>
	<DotProduct
		name={'gₕ[' + j + '] = Σ W[k, ' + j + $t('] × g оценки[k]')}
		weights={column('Выход', j)}
		input={g.logits}
	/>
{:else}
	<p>
		{$t(
			'Совместная производная softmax и ошибки −ln(p цели) по оценке символа k равна (pₖ − yₖ) / N. Для правильного символа y = 1, для остальных y = 0. Деление на N учитывает усреднение ошибки по слову.'
		)}
	</p>
	<p>
		{$t('Для цели с ID')}
		{f.target}
		{$t('получаем (')}{$fmt(f.probabilities[f.target])} − 1) / {n} ≈ {$fmt(g.targetLogit)}.
	</p>
{/if}

<style>
	p {
		margin: 0.7rem 0;
		font-size: 0.87rem;
		line-height: 1.5;
	}
</style>
