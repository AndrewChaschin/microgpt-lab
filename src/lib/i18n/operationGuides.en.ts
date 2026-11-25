import { width } from '$lib/microgpt/model';
import { glossaryButton as term } from '~/utils/glossary';
import { matrixSymbol, operationExplanation, type GuideId } from '$lib/microgpt/operationGuides';

type Text = { purpose: string; notation: string; pseudocode: string; formula?: string };
type Guide = { forward: Text; reverse?: Text };
function explain(purpose: string, notation: string, pseudocode: string, formula?: string): Text {
	return { purpose, notation, pseudocode, formula };
}

function lookup(table: 'E' | 'P'): Guide {
	const token = table === 'E';
	const row = token ? 'id' : 't';
	const index = token ? '\\mathrm{id}' : 't';
	const out = token ? 'e' : 'p';

	return {
		forward: explain(
			token
				? `Each letter has its own row in E. Think of a card that gets revised after practice. Occurrences of the same letter in different words all help shape its ${term('embedding', 'numerical representation')}. What the model learns from “rain” can therefore also help when it reads “rainbow”.`
				: `Position 2 uses the same row of P in every word. Training on different letters at that position adjusts the same settings. This lets the ${term('positionEmbedding', 'position vector')} capture patterns tied to a place in the word even when the letter changes.`,
			String.raw`$${table}$ is the table of trainable ${term('weights', 'weights')}. $${index}$ selects a row by ${token ? 'character ID' : 'position in the word'}, and $j$ selects a column. $${out}_j$ is the value read from that cell. The cells start with small random values. After a prediction, ${term('adam', 'Adam')} adjusts them using the loss gradient. This lets the model learn combinations of features that help predict what comes next.`,
			`read ${row} and table ${table}\nselect row ${row}\nreturn its coordinates in column order`
		),
		reverse: explain(
			token
				? 'Both occurrences of “o” in “moon” used the same row of E. If they both favour increasing one weight, their contributions reinforce each other. If they favour opposite changes, the contributions partly cancel.'
				: 'The two occurrences of “o” in “moon” use different rows of P. Training can adjust the cue for position 2 separately from the cue for position 3. The next word will use the updated row when it reaches position 2.',
			String.raw`$${index}$ is the ${token ? 'character ID' : 'position in the word'}, and $j$ is the coordinate index. $g(${out})_j$ is the contribution from the coordinate read. $g(${table})_{${index},j}$ collects contributions each time that cell is used.`,
			`read the saved row index ${row}\nfor each column j:\n    add g(${out})[j] to g(${table})[${row}, j]`
		)
	};
}

function addition(left: string, right: string, out: string, purpose: string): Guide {
	return {
		forward: explain(
			purpose,
			String.raw`$${left}$ and $${right}$ are the input ${term('vector', 'vectors')}, and $${out}$ is their sum. Index $j$ selects the same coordinate in all three. The sign of the second input determines whether that coordinate rises or falls.`,
			`for each coordinate j:\n    ${out}[j] ← ${left}[j] + ${right}[j]\nreturn ${out}`
		),
		reverse: explain(
			`Increasing either input by 0.1 in one coordinate raises the sum by 0.1 there. The prediction loss therefore sends a learning signal down both branches. Each branch then traces that signal to its own weights.`,
			String.raw`$g(${out})_j$ is the gradient of the loss with respect to coordinate $j$ of the sum. $g(${left})_j$ and $g(${right})_j$ are the gradients for that coordinate of the two inputs. Each receives the full contribution from the sum.`,
			`for each coordinate j:\n    add g(${out})[j] to g(${left})[j]\n    add g(${out})[j] to g(${right})[j]`
		)
	};
}

function normalize(x: string, y: string, context: string): Guide {
	const vectors = `$${x}$ is the input vector and $${y}$ the normalized vector. $${x}_j$ and $${y}_j$ are their coordinates at index $j$.`;
	const size = `$D$ is the number of coordinates per vector. Here $D = ${width}$.`;
	return {
		forward: explain(
			context,
			[
				vectors,
				size,
				`$j$ is a coordinate index from $0$ to $${width - 1}$. The sum $\\sum$ adds the squares over all these coordinates.`,
				'$s$ is the shared divisor for all coordinates at this position.',
				'$\\varepsilon = 10^{-5}$ keeps the divisor positive even when every input coordinate is zero.'
			].join('\n'),
			`s ← square root of (mean of squared coordinates of ${x} + ε)\nfor each j: ${y}[j] ← ${x}[j] / s\nreturn ${y}`
		),
		reverse: explain(
			'Increasing the magnitude of one coordinate raises the shared divisor. Even outputs whose own input stayed fixed can change. Measuring the effect of this one coordinate on loss therefore requires looking at all the outputs.',
			[
				vectors,
				size,
				`$j$ selects one coordinate. Index $k$ runs from $0$ to $${width - 1}$, and $\\sum$ adds the contributions.`,
				'$s$ is the divisor saved on the forward pass.',
				`$g(${y})$ and $g(${x})$ are the ${term('gradient', 'gradients')} of the mean word loss with respect to the output and input. The subscript selects a gradient coordinate.`,
				'$c$ is the mean of the products of the output gradient and input coordinates. It accounts for the shared divisor.'
			].join('\n'),
			`read the saved input ${x} and divisor s\nc ← mean of g(${y})[k] · ${x}[k]\nfor each j:\n    add g(${y})[j] / s − ${x}[j] · c / s³ to g(${x})[j]`
		)
	};
}

function linear(w: string, x: string, y: string, purpose: string): Guide {
	const matrix = matrixSymbol(w);
	const output = y === 'c₂' ? '(c_2)' : y;
	return {
		forward: explain(
			purpose,
			String.raw`$${x}_j$ is input coordinate $j$, and $${output}_i$ is output coordinate $i$. $(${matrix})_{ij}$ is the weight connecting them. With a weight of $-2$, increasing that input alone by $0.1$ lowers the output by $0.2$. The ${term('summation', 'sum')} $\sum_j$ collects all input contributions to one output, giving the ${term('dotProduct', 'dot product')}.`,
			`for each row i of ${w}:\n    total ← 0\n    for each column j: total ← total + ${w}[i, j] · ${x}[j]\n    ${y}[i] ← total\nreturn ${y}`
		),
		reverse: explain(
			`If an input is zero at this position, changing the weight multiplying it has no effect here. This position contributes zero to that weight’s gradient. The same weight can receive a strong signal elsewhere. Learning thus takes account of which inputs actually affected the forecast.`,
			String.raw`$${x}_j$ is input coordinate $j$, and $g(${y})_i$ is the gradient for output $i$. The weight $(${matrix})_{ij}$ scales the signal from that output back to the input. Adding all output signals into $g(${x})_j$ multiplies by the ${term('transpose', 'transposed matrix')}. $g(${matrix})_{ij}$ collects contributions from all positions that used this weight.`,
			`for each output i and input j:\n    add ${w}[i, j] · g(${y})[i] to g(${x})[j]\n    add ${x}[j] · g(${y})[i] to g(${w})[i, j]`
		)
	};
}

function softmax(x: string, y: string, purpose: string, indices: string): Guide {
	return {
		forward: explain(
			purpose,
			String.raw`$${x}_i$ is the score of candidate $i$. Index $k$ runs over ${indices}, and $M$ is their highest score. $a_i$ is the ${term('exponential', 'exponential')} $\exp$ of the score after subtracting $M$. The highest score gives $a_i=1$ and all other values are at most one. Dividing by the total $\sum_k a_k$ turns $a_i$ into the share $${y}_i$.`,
			`M ← largest score\nfor each i: a[i] ← exp(${x}[i] − M)\nS ← sum of a\nfor each i: ${y}[i] ← a[i] / S\nreturn ${y}`
		),
		reverse: explain(
			`Increasing all scores by the same amount leaves the shares unchanged. What matters is how much one score should move relative to the others. The backward pass therefore subtracts the same weighted mean from the signal for each candidate.`,
			String.raw`$${y}_i$ is candidate $i$’s share, $g(${y})_i$ is the gradient for that share, and $g(${x})_i$ is the gradient for its original score. Index $k$ runs over ${indices}. Their shares weight the average $c$. The difference $g(${y})_i-c$ compares this candidate’s signal with that average.`,
			`c ← sum of ${y}[k] · g(${y})[k]\nfor each i:\n    add ${y}[i] · (g(${y})[i] − c) to g(${x})[i]`
		)
	};
}

const guides: Record<GuideId, Guide> = {
	symbol: {
		forward: explain(
			'Try completing “rai…”. Both “rain” and “rail” fit the letters you have seen. The model faces the same problem. Before the first letter it has only the start marker, so its first prediction can reflect only what it learned about word beginnings.',
			String.raw`$t$ is the ${term('position', 'position')} index, and $\diamond$ is the start marker. Letters are indexed from zero, so at $t=1$ the input is the letter with index $t-1=0$. The final letter supplies the input for predicting the end marker.`,
			'split the word into letters\nif t = 0: return the start marker\notherwise: return letter[t − 1]',
			String.raw`\operatorname{input}(t)=\begin{cases}\diamond & t=0\\ \operatorname{letter}_{t-1} & t>0\end{cases}`
		)
	},
	token: {
		forward: explain(
			`A letter needs a stable address. The “s” in “sun” and “sand” has the same ${term('id', 'ID')}. When training on one word changes the entry for “s”, the other word will use the updated entry too. The number itself only locates the letter in the vocabulary.`,
			String.raw`$\operatorname{id}$ is the ${term('id', 'vocabulary index')} that selects the character’s row of weights. Letters are numbered from zero. The next available index belongs to the word boundary $\diamond$.`,
			'if the input is a boundary: return the boundary ID\nscan the alphabet in order\nreturn the index of the matching letter',
			String.raw`\operatorname{id}(\text{letter})=\text{alphabet index}
\operatorname{id}(\diamond)=\text{alphabet size}`
		)
	},
	place: {
		forward: explain(
			'The two letters “o” in “moon” have the same vocabulary ID. How can the model tell which occurrence it is reading? The counter t gives them different addresses in the position table P. The start marker occupies position 0, so these letters occupy positions 2 and 3.',
			String.raw`$t$ is the current position, and $N$ counts predictions for the word, including the end marker. Each word starts at $0$ and its last position is $N-1$.`,
			'start at zero on the start marker\npass the current index t to P\nincrement t for the next input'
		)
	},
	embedding: lookup('E'),
	position: lookup('P'),
	combined: addition(
		'e',
		'p',
		'x',
		`In “moon”, the first “o” is followed by another “o”, and the second by “n”. Both use the same ${term('tokenEmbedding', 'letter vector')} from E. Adding the ${term('positionEmbedding', 'position vector')} from P lets attention treat the two occurrences differently. The probability of “n” also depends on the letters read so far. The model computes those probabilities at its output.`
	),
	input: normalize(
		'x',
		'b',
		'Adding the letter and position vectors gives the input x. Its magnitude can vary from one position to another. Larger numbers could then dominate later calculations simply because of their scale. Dividing all coordinates by the same number preserves their proportions.'
	),
	normalized: normalize(
		'b',
		'u',
		'A query and a key will be compared by multiplying matching coordinates. Doubling both vectors would quadruple that score even with their directions unchanged. The model therefore controls the input scale before computing Q, K and V. Here the preceding block already normalized the input, so the second normalization usually changes little.'
	),
	query: linear(
		'Wq',
		'u',
		'Q',
		`Which part of the word so far might help now? The ${term('qkv', 'query Q')} sets the search criterion. Wq learns which features of the current letter and position to use when looking for matches. Changing the query can shift attention to a different earlier letter.`
	),
	key: linear(
		'Wk',
		'u',
		'K',
		`A ${term('qkv', 'key K')} works like a heading on an index card. A query uses it to find a position worth reading. The same stored key can be a good match for one query and receive little attention from another.`
	),
	value: linear(
		'Wv',
		'u',
		'V',
		`Once a query has found a useful position, what does it retrieve? The ${term('qkv', 'value vector V')} supplies that content. Changing only V while keeping queries and keys fixed preserves the attention shares but changes the information passed on.`
	),
	rawScores: {
		forward: explain(
			`Each ${term('head', 'attention head')} has its own matching criterion. Large query and key coordinates with matching signs raise the pair’s score. An earlier letter can therefore be a better match than an adjacent one. Future letters are excluded so the model cannot look up the answer.`,
			String.raw`$t$ is the current position, and $s$ is any position up to and including $t$. $Q_j$ is one coordinate of the query, and $K_{s,j}$ is the matching coordinate of the key at $s$. Index $j$ runs over the coordinates in one head. Their ${term('dotProduct', 'dot product')} gives the match score $r_s$.`,
			'take the query coordinates for this head\nfor each available position s:\n    multiply matching coordinates of Q and K[s]\n    store the sum of products in r[s]'
		),
		reverse: explain(
			`One query was compared with every available key. A match that mattered to the prediction contributes a signal for both the query and its matching key. The query receives the sum of the contributions from all of its comparisons.`,
			String.raw`$s$ selects a key position and $j$ a coordinate within the head. $g(r)_s$ is the signal from the match score. Key coordinate $K_{s,j}$ scales the contribution to the query gradient $g(Q)_j$, and query coordinate $Q_j$ scales the contribution to the key gradient $g(K)_{s,j}$. The same query is used for every comparison, so its contributions are summed over $s$.`,
			'for each position s and head coordinate j:\n    add g(r)[s] · K[s, j] to g(Q)[j]\n    add g(r)[s] · Q[j] to g(K)[s, j]'
		)
	},
	scores: {
		forward: explain(
			'Suppose two matches score 2 and 6. A head here has four coordinates, so the divisor is two and the scores become 1 and 3. The leader stays the same, but the gap narrows. The next softmax will give the runner-up a larger share.',
			String.raw`$r_i$ and $s_i$ are the scores for available position $i$ before and after scaling. $d$ counts the coordinates in one head. All positions share the divisor $\sqrt d$, which preserves their ranking.`,
			'compute √d\nfor each i: s[i] ← r[i] / √d\npass s to softmax'
		),
		reverse: explain(
			`With head width 4, the original score was divided by 2. Raising it by 0.1 changes the next block’s input by just 0.05. For the same reason, half of the gradient passes back to the original score.`,
			String.raw`$i$ is an available position, and $d$ counts the coordinates in the head. $g(s)_i$ is the gradient for the scaled score, and $g(r)_i$ is the gradient for its original score. The factor $1/\sqrt d$ is the same as on the forward pass.`,
			'for each i:\n    add g(s)[i] / √d to g(r)[i]'
		)
	},
	attention: softmax(
		's',
		'α',
		`A head distributes its attention over the positions read so far. With just two equally scored positions, each gets half. Raising one score makes ${term('softmax', 'softmax')} increase its share at the expense of the other. The shares determine how much information to take from each position.`,
		'the available positions in one head'
	),
	mix: {
		forward: explain(
			`The attention head multiplies each available position’s value vector by its attention share and adds the resulting vectors. Suppose two positions carry 4 and −2 in one coordinate. With equal ${term('attentionWeights', 'attention shares')} the weighted sum is 1. Giving three quarters of the attention to the first position makes it 2.5. Changing the focus changes the signal carried forward.`,
			String.raw`$s$ is a source position, and $\alpha_s$ is its attention share. $V_{s,j}$ is coordinate $j$ of that position’s value vector. $m_j$ is the matching coordinate of the head output. The sum over $s$ includes every available position, with one share for all coordinates of a source.`,
			'for each head coordinate j:\n    multiply V[s, j] by α[s] at each position s\n    sum the products into m[j]'
		),
		reverse: explain(
			`When a position has a small attention share, changing its value has little effect on the head output. Its value therefore receives a small fraction of the head output gradient. Changing the share itself can also help if that position carried information the forecast needed.`,
			String.raw`$g(m)_j$ is the gradient for coordinate $j$ of the head output. At source position $s$, the attention share $\alpha_s$ scales the contribution to the value gradient $g(V)_{s,j}$. To obtain the contribution to the share gradient $g(\alpha)_s$, sum the products of $V_{s,j}$ and $g(m)_j$ over all coordinates.`,
			'for each s and j:\n    add α[s] · g(m)[j] to g(V)[s, j]\n    add V[s, j] · g(m)[j] to g(α)[s]'
		)
	},
	merged: {
		forward: explain(
			`Two ${term('head', 'heads')} can focus on different letters. Averaging their outputs immediately would cancel +1 from one head against −1 from another in the same coordinate. Placing the results side by side keeps both numbers available for the next layer to use differently.`,
			String.raw`$h$ is the head index starting at zero, and $d$ is the number of coordinates per head. Coordinate $j$ of head output $m_h$ occupies slot $hd+j$ in the combined vector $c$. For example, with $d=4$, coordinate $0$ of head $1$ occupies slot $4$.`,
			'for each head h in order:\n    append its coordinates to c\nreturn c'
		),
		reverse: explain(
			`Joining the heads kept a separate slot for each coordinate. If the loss is sensitive to one slot, that signal goes to the head that supplied it. The other heads receive signals from their own slots.`,
			String.raw`$h$ is the head index, $d$ its width, and $j$ a coordinate within it. $g(c)_{hd+j}$ is the signal from the corresponding slot in the combined vector. It flows back to $g(m_h)_j$, the gradient for the head and coordinate that supplied the value.`,
			'for each head h:\n    take d gradients starting at h · d\n    send them to the corresponding coordinates of that head'
		)
	},
	projected: linear(
		'O',
		'c',
		'v',
		'The heads’ answers still occupy separate parts of the vector. Matrix O learns how to combine them. Signals from two different heads can reinforce the same output coordinate or partially cancel each other.'
	),
	attended: addition(
		'b',
		'v',
		'a',
		`Attention gathered information from several positions. To retain information about the current letter itself, the model adds the attention result to its original vector. This is a ${term('residual', 'residual connection')}. Wherever attention contributes zero, that original coordinate passes through unchanged.`
	),
	mlpInput: normalize(
		'a',
		'n',
		`Signals from the heads can reinforce each other in one context and partly cancel in another. The attention output can therefore vary in magnitude. Normalizing gives the ${term('mlp', 'MLP')} a consistent scale for detecting feature combinations. The original vector is also carried around the block for the final addition.`
	),
	expanded: linear(
		'W₁',
		'n',
		'z',
		`One feature of a letter can fit several continuations. A combination of features from the letter, its position and the preceding letters can be more telling. The first ${term('mlp', 'MLP')} layer tests 64 combinations of the 16 input coordinates. Its learned weights and the current input determine which combinations respond.`
	),
	activated: {
		forward: explain(
			`${term('relu', 'ReLU')} acts as a threshold on each feature combination. A response of −2 sends nothing down that branch, while +2 sends 2. Different words can thus activate different branches. Without that switch the two consecutive linear layers could be replaced by one.`,
			String.raw`$z_j$ is the first layer’s response at coordinate $j$, and $r_j$ is the value sent to the second layer. $\max$ selects the larger of zero and the response. A positive response passes through in full.`,
			'for each j:\n    if z[j] > 0: r[j] ← z[j]\n    otherwise: r[j] ← 0'
		),
		reverse: explain(
			`At an input of −2, a small change still gives zero after ReLU. The loss is locally insensitive to that change through this branch. A positive input passes small changes through in full, so its gradient passes through in full too.`,
			String.raw`$z_j$ is the forward input at coordinate $j$, and $g(r)_j$ is the signal from its output. The input gradient $g(z)_j$ receives that signal when $z_j>0$. At $z_j=0$ this implementation uses a derivative of zero.`,
			'for each j:\n    if z[j] > 0: add g(r)[j] to g(z)[j]\n    otherwise: contribute zero'
		)
	},
	contracted: linear(
		'W₂',
		'r',
		'c₂',
		'Active features can suggest different continuations. Matrix W₂ determines which signals to combine and with what sign. Its result has 16 coordinates again, allowing each number to correct the corresponding input coordinate.'
	),
	hidden: addition(
		'a',
		'c₂',
		'h',
		`The context read so far meets the correction from the MLP here. If none of the intermediate features fires, the MLP contributes zeros. The ${term('residual', 'residual connection')} still carries the letter and its context to the output layer so it can make a prediction.`
	),
	logits: linear(
		'W',
		'h',
		'z',
		`Every possible answer is now scored against the same context vector h. The letter “a” and the word boundary each have their own row of weights. The same feature can therefore raise the letter’s score and lower the score for ending the word. These scores are called ${term('logit', 'logits')}.`
	),
	probabilities: softmax(
		'z',
		'p',
		`So far each candidate has a score. What matters for probability is the gap between scores. Two letters can be almost tied, giving one a narrow lead. If one letter is far ahead of every other candidate, ${term('softmax', 'softmax')} gives it a probability close to one.`,
		'vocabulary characters'
	),
	argmax: {
		forward: explain(
			'With probabilities of 40%, 35% and 25%, the first character wins even though the alternatives together have 60%. That is why the card shows both the character and its probability. All probabilities remain available for training even if the wrong letter came first.',
			String.raw`$i$ runs over ${term('id', 'vocabulary indices')}, and $p_i$ is the probability of character $i$. The operation $\operatorname{argmax}$ finds the winning index $k$, while $\max$ gives its probability $p_k$. Ties go to the lowest index.`,
			'select the first vocabulary entry\nfor each remaining entry:\n    if its probability is higher, select it\nreturn the selected character and its probability'
		)
	},
	target: {
		forward: explain(
			`After “rain”, the target in “rainbow” is “b”, while in “rainfall” it is “f”. With the same weights the model gives the same forecast for “rain” in both words. What differs is the probability used to grade it. The ${term('id', 'ID')} of the next training character selects that entry.`,
			String.raw`$k$ is the ID of the correct next character in the training word. The vector $p$ contains all character probabilities. $p_*$ is the probability used to calculate the loss, taken from entry $p_k$.`,
			'read the next character ID from the training sequence\nselect p at that ID\npass this probability to the logarithm'
		),
		reverse: explain(
			`The loss at this position was calculated from the probability of the correct character. Only that probability initially receives its gradient. Softmax then passes a signal to the competing scores as well, because raising a competitor’s score reduces the share left for the correct character.`,
			String.raw`$k$ is the target character ID saved on the forward pass. The selected probability’s gradient $g(p_*)$ is added to $g(p)_k$, the gradient for entry $k$ of the probability vector. This operation contributes zero to the other entries.`,
			'read the saved target ID k\nadd the gradient of the selected probability to g(p)[k]'
		)
	},
	log: {
		forward: explain(
			`The same increase in probability can mean different things. Moving the correct letter from 1% to 2% doubles its probability. Moving it from 80% to 81% barely changes an already confident prediction. The ${term('logarithm', 'logarithm')} gives the first improvement more credit.`,
			String.raw`$p_*$ is the correct character’s probability, $\ln$ is the natural logarithm, and $l$ is the result. At $p_*=1$ we get $l=0$. A smaller probability gives a lower value of $l$.`,
			'read target probability p*\ncompute l ← ln(p*)\npass l to the negation block'
		),
		reverse: explain(
			`At probability 0.01 the logarithm has slope 100. At probability 0.5 its slope is 2. The same small probability increase has more effect on the loss where the model had almost ruled out the correct answer.`,
			String.raw`$p_*$ is the correct character’s probability, and $l$ is its logarithm. Dividing the incoming gradient $g(l)$ by $p_*$ gives the contribution to the probability gradient $g(p_*)$. A smaller $p_*$ amplifies the signal more.`,
			'read the saved p*\ndivide g(l) by p*\nadd the result to g(p*)'
		)
	},
	loss: {
		forward: explain(
			`Even two wrong guesses can differ. Giving the correct character 40% yields a ${term('loss', 'loss')} of about 0.92. Giving it 1% raises the loss to about 4.61. A forecast can improve even before the correct letter takes first place.`,
			String.raw`$p_*$ is the correct character’s probability, $l$ its natural logarithm, and $\ell$ the loss at this position. For a confident correct prediction, $p_*$ is close to one and $\ell$ is close to zero.`,
			'read the log probability l\nreturn its negative'
		),
		reverse: explain(
			`A larger log probability for the correct letter gives a smaller loss. Negation therefore flips the sign of the gradient here. Reducing the loss rewards an increase in the probability of the training answer.`,
			String.raw`$\ell$ is the loss at one position, and $l$ is the log probability of the correct character. The incoming gradient $g(\ell)$ changes sign on its way to $g(l)$ because increasing $l$ decreases the loss by the same amount.`,
			'negate the incoming g(ℓ)\nadd the result to g(l)'
		)
	},
	mean: {
		forward: explain(
			`A long word has more predictions and more opportunities to go wrong. Averaging the ${term('loss', 'losses')} over all positions, including the end marker, measures the cost per prediction. One training step can improve a difficult transition and worsen another. Both contribute to the gradient of the shared weights.`,
			String.raw`$N$ counts predictions for the word, including its end. $\ell_t$ is the loss at position $t$. The ${term('summation', 'sum')} $\sum$ collects the losses from position $0$ through $N-1$, and dividing by $N$ gives the mean loss $L$ per prediction.`,
			'collect the losses at all positions\nsum them and divide by N\nreturn the mean L'
		),
		reverse: explain(
			`“Moon” gives five predictions including the end marker. Reducing one position’s loss by 0.1 while holding the others fixed reduces the mean by 0.02. That is why ${term('backpropagation', 'backpropagation')} sends a share of 1/N to each position.`,
			String.raw`$L$ is the mean word loss. The backward pass starts with $g(L)=1$, the derivative of the loss with respect to itself. $N$ counts predictions. The loss $\ell_t$ at each position $t$ has weight $1/N$ in the mean, so $g(\ell_t)$ receives that same fraction of the signal.`,
			'start with g(L) ← 1\nfor each position t:\n    add g(L) / N to the gradient of ℓ[t]'
		)
	},
	adam: {
		forward: explain(
			`One example can push a weight up and the next can push it down. ${term('adam', 'Adam')} takes recent ${term('gradient', 'gradients')} into account. Alternating signs partly cancel in the moving average m. A consistent direction tends to move the weight the same way across steps. A second average v tracks squared gradients to scale the update separately for each weight.`,
			[
				String.raw`$w$ is the weight being updated, $g$ its gradient, and $k$ the step number starting at one. The arrow $\leftarrow$ assigns the new value.`,
				String.raw`$m$ averages gradients, and $v$ averages their squares. $\beta_1=0.85$ and $\beta_2=0.99$ set the fractions of the previous averages retained in each update.`,
				String.raw`$\hat m$ and $\hat v$ account for both averages starting at zero. $\eta$ is the learning rate, starting at $0.004$ and decreasing with each step. $\varepsilon=10^{-8}$ keeps the denominator positive.`
			].join('\n'),
			'for each weight w:\n    read its accumulated gradient g\n    update moving averages m and v\n    correct both averages for step k\n    subtract the calculated update from w\n    keep w, m and v for the next step'
		)
	}
};

export function englishOperationExplanation(id: GuideId, backward: boolean) {
	const guide = guides[id];
	const text = backward ? guide.reverse : guide.forward;
	if (!text) throw new Error('No backward pass for ' + id);
	const formula =
		text.formula ?? operationExplanation(id, backward).formula.replace('0{,}004', '0.004');
	return { ...text, formula };
}
