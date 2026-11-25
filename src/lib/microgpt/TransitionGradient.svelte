<script lang="ts">
	import { fmt, mathNumber, t } from '$lib/i18n';
	import { headWidth, type Lesson, type Weight } from './model';
	import Formula from './Formula.svelte';
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
	<Formula
		notation={$t(
			'$g(x)$ — градиент по сумме векторов. В градиенте таблицы символов $g(E)$ складываются вклады всех вхождений буквы. В градиент таблицы позиций $g(P)$ попадает вклад только выбранной позиции.'
		)}
		tex={String.raw`g(E)_{${f.token},${j}}\approx ${$mathNumber(f.weights.E[j].gradient)}
g(P)_{${position},${j}}=g(x)_{${j}}\approx ${$mathNumber(g.combined[j])}`}
	/>
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
	<Formula
		notation={$t(
			'$g(u)$ — градиент по нормированному входу. Показанная координата собирает вклады запроса, ключа и значения.'
		)}
		tex={String.raw`g(u)_{${j}}\approx ${$mathNumber(g.normalized[j])}`}
	/>
{:else if index === 3}
	<p>
		{$t('Значение V позиции')}
		{position}
		{$t(
			'участвует во взвешенной сумме в этой и каждой последующей позиции. Вклад в градиент значения равен градиенту по выходу головы в соответствующей позиции, умноженному на долю внимания к позиции'
		)}
		{position}.
	</p>
	<ColumnValues
		firstHeading={$t('Позиция запроса')}
		rowLabels={lesson.positions.slice(position).map((_, k) => String(position + k))}
		columns={[
			{
				name: $t('Доля α'),
				before: lesson.positions.slice(position).map((v) => v.attention[head][position])
			},
			{
				name: $t('Градиент по выходу головы'),
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
	<Formula
		notation={$t(
			'$g(V)$ — градиент по вектору значения в выбранной позиции. В этой координате складываются вклады всех позиций, где голова использовала это значение.'
		)}
		tex={String.raw`g(V)_{${j}}\approx ${$mathNumber(g.value[j])}`}
	/>
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
	<Formula
		notation={$t(
			'$g(a)$ — градиент по выходу внимания. Первое слагаемое приходит напрямую через сложение, второе проходит через слои MLP.'
		)}
		tex={String.raw`g(a)_{${j}}\approx ${$mathNumber(g.hidden[j])}+\bigl(${$mathNumber(g.attended[j] - g.hidden[j])}\bigr)\approx ${$mathNumber(g.attended[j])}`}
	/>
{:else if index === 5}
	<p>
		{$t('Координата h[')}{j}{$t(
			'] участвует в оценке каждого символа. Умножаем градиент каждой оценки на соответствующий вес выходной матрицы и складываем вклады.'
		)}
	</p>
	<DotProduct
		notation={$t(
			'$g(h)$ — градиент по выходу блока, $g(z)_k$ — градиент по оценке символа $k$. Вес матрицы $W$ определяет вклад этой оценки в выбранную координату.'
		)}
		tex={String.raw`g(h)_{${j}}=\sum_k W_{k,${j}}\,g(z)_k`}
		weights={column('Выход', j)}
		input={g.logits}
	/>
{:else}
	<p>
		{$t(
			'Совместная производная softmax и ошибки −ln(p цели) по оценке символа k равна (pₖ − yₖ) / N. Для правильного символа y = 1, для остальных y = 0. Деление на N учитывает усреднение ошибки по слову.'
		)}
	</p>
	<Formula
		notation={$t(
			'$g(z)$ — градиент по оценкам символов, $p$ — их вероятности. Индекс выбирает правильный символ, поэтому из его вероятности вычитается $1$. Знаменатель — число предсказаний в слове, включая конец.'
		)}
		tex={String.raw`g(z)_{${f.target}}=\frac{p_{${f.target}}-1}{${n}}\approx\frac{${$mathNumber(f.probabilities[f.target])}-1}{${n}}\approx ${$mathNumber(g.targetLogit)}`}
	/>
{/if}

<style>
	p {
		margin: 0.7rem 0;
		font-size: 0.87rem;
		line-height: 1.5;
	}
</style>
