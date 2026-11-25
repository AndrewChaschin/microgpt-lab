<script lang="ts">
	import { mathNumber, t } from '$lib/i18n';
	import { headWidth, type Lesson, type Weight } from './model';
	import { corpora } from './corpora';
	import Formula from './Formula.svelte';
	import DotProduct from './DotProduct.svelte';
	import ColumnValues from './ColumnValues.svelte';
	export let index: number;
	export let lesson: Lesson;
	export let position: number;
	export let coordinate: number;
	export let after: boolean;
	$: ({ boundary, vocabulary } = corpora[lesson.language]);
	$: symbol = (id: number, end = false) =>
		id === boundary ? (end ? $t('конец слова') : $t('начало слова')) : vocabulary[id];
	const rms = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length + 1e-5);
	$: frames = (after && lesson.afterPositions) || lesson.positions;
	$: f = frames[position];
	$: j = coordinate;
	$: h = Math.floor(j / headWidth);
	$: shares = f.attention[h];
	$: scores = frames
		.slice(0, position + 1)
		.map(
			(src) =>
				src.key
					.slice(h * headWidth, (h + 1) * headWidth)
					.reduce((s, k, n) => s + k * f.query[h * headWidth + n], 0) / Math.sqrt(headWidth)
		);
	$: row = (key: Weight, out: number) =>
		lesson.tables[key][out].map((w) => (after ? w.after : w.before));
	$: logitsMax = Math.max(...f.logits);
	$: denominator = f.logits.reduce((s, v) => s + Math.exp(v - logitsMax), 0);
	$: prefix = lesson.word.slice(0, position);
</script>

<div class="math-detail">
	{#if index === 0}
		<p>
			{$t(
				'В позиции 0 модель получает знак начала. В позиции t ≥ 1 она читает букву с индексом t − 1 в слове. Для каждой буквы словарь хранит постоянный номер.'
			)}
		</p>
		<p>{$t('Символ на входе')} · {symbol(f.token)}</p>
		<Formula
			notation={$t(
				'$t$ — позиция входа в слове, $\\mathrm{id}$ — номер прочитанного символа в словаре.'
			)}
			tex={String.raw`t=${position},\quad \mathrm{id}=${f.token}`}
		/>
	{:else if index === 1}
		<p>
			{$t(
				'Номер символа выбирает строку таблицы E, позиция — строку таблицы P. Складываются числа с одинаковым номером координаты j.'
			)}
		</p>
		<Formula
			notation={$t(
				'$E$ — таблица символов, $P$ — таблица позиций, $x$ — сумма двух выбранных строк. Первый индекс выбирает строку, второй — координату. Знак $\\approx$ отмечает округление.'
			)}
			tex={String.raw`x_{${j}}=E_{${f.token},${j}}+P_{${position},${j}}
\approx ${$mathNumber(f.embedding[j])}+\bigl(${$mathNumber(f.position[j])}\bigr)\approx ${$mathNumber(f.combined[j])}`}
		/>
		<ColumnValues
			columns={[
				{ name: 'E', before: f.embedding },
				{ name: 'P', before: f.position },
				{ name: 'E + P', before: f.combined }
			]}
			marked={j}
		/>
	{:else if index === 2}
		<Formula
			notation={$t(
				'$b$ — результат первой нормировки, $u$ — второй. В числителе показана выбранная координата, в знаменателе — корень из среднего квадрата всех координат с добавкой $10^{-5}$ под корнем.'
			)}
			tex={String.raw`b_{${j}}\approx\frac{${$mathNumber(f.combined[j])}}{${$mathNumber(rms(f.combined))}}\approx ${$mathNumber(f.input[j])}
u_{${j}}\approx\frac{${$mathNumber(f.input[j])}}{${$mathNumber(rms(f.input))}}\approx ${$mathNumber(f.normalized[j])}`}
		/>
		<p>
			{$t(
				'Каждая из трёх матриц умножается на один и тот же вектор u. Откройте сумму, чтобы увидеть вклад каждой координаты.'
			)}
		</p>
		{#each ['Q', 'K', 'V'] as key}<DotProduct
				notation={$t(
					'$Q$ — запрос, $K$ — ключ, $V$ — значение. В показанном произведении строка соответствующей матрицы весов выбирает выходную координату, а $k$ перебирает координаты нормированного входа $u$.'
				)}
				tex={String.raw`${key}_{${j}}=\sum_k (W_{${key.toLowerCase()}})_{${j},k}\,u_k`}
				input={f.normalized}
				weights={row(key as Weight, j)}
			/>{/each}
	{:else if index === 3}
		<p>
			{$t('Голова')}
			{h + 1}
			{$t('использует координаты')}
			{h * headWidth}–{(h + 1) * headWidth - 1}{$t(
				'. Для каждой доступной позиции s она перемножает соответствующие координаты запроса Q текущей позиции и ключа K позиции s, складывает произведения и делит сумму на √'
			)}{headWidth}.
		</p>
		<Formula
			notation={$t(
				'$s_i$ — оценка позиции $i$, $\\alpha_i$ — её доля внимания. В числителе первой дроби перемножаются координаты $k$ запроса $Q$ и ключа $K$ позиции $i$. Под корнем стоит ширина головы. Вторая дробь делит экспоненту оценки на сумму экспонент по доступным позициям $r$.'
			)}
			tex={String.raw`s_i=\frac{\sum_k Q_k K_{i,k}}{\sqrt{${headWidth}}}
\alpha_i=\frac{\exp(s_i)}{\sum_{r=0}^{${position}}\exp(s_r)}`}
		/>
		<p>
			{$t(
				'Доли α суммируются до единицы. Каждая доля определяет вклад значения V в выход головы по координате'
			)}
			{j}.
		</p>
		<ColumnValues
			firstHeading="s"
			columns={[
				{ name: $t('Оценка'), before: scores },
				{ name: $t('Доля α'), before: shares },
				{ name: 'V[' + j + ']', before: frames.slice(0, position + 1).map((x) => x.value[j]) },
				{ name: 'α × V', before: shares.map((a, s) => a * frames[s].value[j]) }
			]}
		/>
		<Formula
			notation={$t(
				'$s$ — позиция источника, $\\alpha_s$ — её доля внимания. Координата общего вектора $c$ складывается из соответствующих координат значений $V$, взятых с этими долями.'
			)}
			tex={String.raw`c_{${j}}=\sum_{s=0}^{${position}}\alpha_s V_{s,${j}}\approx ${$mathNumber(f.merged[j])}`}
		/>
		<DotProduct
			name={$t('Скалярное произведение объединённого вектора голов со строкой ') +
				j +
				$t(' матрицы O')}
			input={f.merged}
			weights={row('O', j)}
		/>
		<Formula
			notation={$t(
				'$b$ — нормированный вход, $c$ — объединённые ответы голов, $O$ — матрица весов, которая их смешивает. Координата выхода $a$ получает исходное число и поправку из $Oc$.'
			)}
			tex={String.raw`a_{${j}}=b_{${j}}+(Oc)_{${j}}
\approx ${$mathNumber(f.input[j])}+\bigl(${$mathNumber(f.attended[j] - f.input[j])}\bigr)\approx ${$mathNumber(f.attended[j])}`}
		/>
	{:else if index === 4}
		<p>
			{$t(
				'Выход внимания a нормируется перед первым слоем MLP. Нормировка N делит все координаты на √(среднее квадратов + 0,00001).'
			)}
		</p>
		<Formula
			notation={$t(
				'$a$ — выход внимания, $N(a)$ — тот же вектор после нормировки. Число в знаменателе задаёт масштаб для всех его координат.'
			)}
			tex={String.raw`N(a)_{${j}}\approx\frac{${$mathNumber(f.attended[j])}}{${$mathNumber(rms(f.attended))}}\approx ${$mathNumber(f.mlpInput[j])}`}
		/>
		<p>
			{$t('Первый слой вычисляет')}
			{f.activated.length}
			{$t('координат. Вот вычисление одной из них.')}
		</p>
		<DotProduct
			notation={$t(
				'$z$ — отклик первого слоя. Индекс $k$ перебирает координаты нормированного входа $N(a)$, а выбранная строка матрицы $W_1$ задаёт вес каждой из них.'
			)}
			tex={String.raw`z_{${j}}=\sum_k (W_1)_{${j},k}\,N(a)_k`}
			input={f.mlpInput}
			weights={row('MLP in', j)}
		/>
		<Formula
			notation={$t(
				'$z$ — отклик до активации. Функция $\\operatorname{ReLU}$ сравнивает его с нулём и передаёт дальше большее из этих чисел.'
			)}
			tex={String.raw`\operatorname{ReLU}(z_{${j}})\approx\max\bigl(0,${$mathNumber(f.expanded[j])}\bigr)\approx ${$mathNumber(f.activated[j])}`}
		/>
		<p>
			{$t('Второй слой использует все')}
			{f.activated.length}
			{$t('результатов ReLU. Затем к его выходу прибавляется вход a.')}
		</p>
		<DotProduct
			notation={$t(
				'$z_k$ — отклик первого слоя с номером $k$. После $\\operatorname{ReLU}$ он умножается на вес из матрицы $W_2$. Сумма этих вкладов даёт координату поправки $c_2$.'
			)}
			tex={String.raw`(c_2)_{${j}}=\sum_k (W_2)_{${j},k}\,\operatorname{ReLU}(z_k)`}
			input={f.activated}
			weights={row('MLP out', j)}
		/>
		<Formula
			notation={$t(
				'$h$ — выход блока. Первое слагаемое пришло с выхода внимания, второе — поправка, рассчитанная вторым слоем.'
			)}
			tex={String.raw`h_{${j}}\approx ${$mathNumber(f.attended[j])}+\bigl(${$mathNumber(f.hidden[j] - f.attended[j])}\bigr)\approx ${$mathNumber(f.hidden[j])}`}
		/>
	{:else if index === 5}
		<p>
			{$t(
				'Каждая строка выходной матрицы переводит вектор h в оценку одного символа. Для цели «'
			)}{symbol(f.target, true)}{$t('» берётся строка')}
			{f.target}.
		</p>
		<DotProduct
			notation={$t(
				'$z$ — оценки символов, $h$ — выход блока. Строка матрицы $W$ соответствует целевому символу, а $k$ перебирает координаты, участвующие в его оценке.'
			)}
			tex={String.raw`z_{${f.target}}=\sum_k W_{${f.target},k}\,h_k`}
			input={f.hidden}
			weights={row('Выход', f.target)}
		/>
		<p>
			{$t(
				'Softmax превращает оценки в вероятности. Для устойчивости из каждой оценки вычитается максимальная m. Знаменатель — сумма экспонент для всех'
			)}
			{f.logits.length}
			{$t('символов.')}
		</p>
		<Formula
			notation={$t(
				'$m$ — наибольшая оценка, $z_k$ — оценка символа $k$. Функция $\\exp$ переводит сдвинутую оценку в положительное число. Деление на сумму по всему словарю даёт вероятность цели из вектора $p$.'
			)}
			tex={String.raw`m\approx ${$mathNumber(logitsMax)}
p_{${f.target}}=\frac{\exp(z_{${f.target}}-m)}{\sum_k\exp(z_k-m)}
\approx\frac{${$mathNumber(Math.exp(f.logits[f.target] - logitsMax))}}{${$mathNumber(denominator)}}\approx ${$mathNumber(f.probabilities[f.target])}`}
		/>
		<ColumnValues
			firstHeading={$t('Символ')}
			rowLabels={vocabulary.map((_, id) => symbol(id, true))}
			columns={[
				{ name: $t('Оценка'), before: f.logits },
				{ name: 'exp(z − m)', before: f.logits.map((z) => Math.exp(z - logitsMax)) },
				{ name: $t('Вероятность'), before: f.probabilities }
			]}
			marked={f.target}
		/>
	{:else}
		<p>
			{$t('Для входа')}
			{prefix ? '«' + prefix + '»' : $t('«начало слова»')}
			{$t('учебная цель — «')}{symbol(f.target, true)}{$t(
				'». Чем меньше вероятность цели, тем больше ошибка. ln — натуральный логарифм.'
			)}
		</p>
		<Formula
			notation={$t(
				'$\\ell$ — потери на выбранной позиции, $p$ — вектор вероятностей. Индекс у $p$ выбирает правильный символ, а $\\ln$ — натуральный логарифм его вероятности.'
			)}
			tex={String.raw`\ell_{${position}}=-\ln(p_{${f.target}})
\approx -\ln(${$mathNumber(f.probabilities[f.target])})\approx ${$mathNumber(-Math.log(f.probabilities[f.target]))}`}
		/>
		<ColumnValues
			firstHeading={$t('Позиция · цель')}
			rowLabels={frames.map((x, s) => s + ' · ' + symbol(x.target, true))}
			columns={[
				{ name: $t('Вероятность'), before: frames.map((x) => x.probabilities[x.target]) },
				{ name: $t('Ошибка ℓ'), before: frames.map((x) => -Math.log(x.probabilities[x.target])) }
			]}
			marked={position}
		/>
		<Formula
			notation={$t(
				'$\\ell_t$ — потери на позиции $t$. Сумма охватывает все предсказания, включая конец слова. $L$ — средние потери за одно предсказание.'
			)}
			tex={String.raw`L=\frac{1}{${frames.length}}\sum_{t=0}^{${frames.length - 1}}\ell_t\approx ${$mathNumber(after ? lesson.lossAfter : lesson.loss)}`}
		/>
	{/if}
</div>

<style>
	.math-detail {
		font-size: 0.87rem;
		line-height: 1.5;
	}
	p {
		margin: 0.65rem 0;
	}
</style>
