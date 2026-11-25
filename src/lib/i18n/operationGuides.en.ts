import { glossaryButton as term } from '~/utils/glossary';
import { operationExplanation, type GuideId } from '$lib/microgpt/operationGuides';

type Text = { purpose: string; notation: string; pseudocode: string; formula?: string };
type Guide = { forward: Text; reverse?: Text };
function explain(purpose: string, notation: string, pseudocode: string, formula?: string): Text {
	return { purpose, notation, pseudocode, formula };
}

function lookup(table: 'E' | 'P'): Guide {
	const token = table === 'E';
	const row = token ? 'id' : 't';
	const out = token ? 'e' : 'p';
	const address = token ? term('id', 'input character ID') : term('position', 'position index');
	return {
		forward: explain(
			`Use the ${address} to select a row of ${term('matrix', 'matrix')} ${table}. ${token ? 'The same letter selects the same E row anywhere in the word.' : 'The same position selects the same P row in every word. Counting starts at the word boundary.'} The whole row goes to the addition block.`,
			`${row} selects a row and j selects a column. The colon selects all columns. Each coordinate is a trainable ${term('weights', 'weight')}. Together they form an ${term('embedding', 'embedding')}. The optimizer changes these values during training. Between updates, the same row always returns the same vector.`,
			`read ${row} and table ${table}\nselect row ${row}\nreturn its coordinates in column order`
		),
		reverse: explain(
			`Each coordinate came from one cell in ${table}. Send its ${term('gradient', 'gradient')} back to that cell. ${token ? 'Repeated occurrences of the same character contribute to the same row.' : 'Each position accumulates its contribution in its own row of P.'}`,
			'Adding the character and position vectors sends the same incoming gradient to both rows. Other rows receive contributions when other positions select them.',
			`read the saved row index ${row}\nfor each column j:\n    add g(${out})[j] to g(${table})[${row}, j]`
		)
	};
}

function addition(left: string, right: string, out: string, purpose: string): Guide {
	return {
		forward: explain(
			purpose,
			`Both inputs have the same number of coordinates. Index j selects matching entries in each ${term('vector', 'vector')}. The output has the same length.`,
			`for each coordinate j:\n    ${out}[j] ← ${left}[j] + ${right}[j]\nreturn ${out}`
		),
		reverse: explain(
			'Increasing either input by a small amount increases the sum by the same amount. Send the full incoming gradient down each input branch.',
			`If another operation used the same input, add its contribution to the ${term('gradient', 'gradient')} as well. This accounts for every path to the word loss.`,
			`for each coordinate j:\n    add g(${out})[j] to g(${left})[j]\n    add g(${out})[j] to g(${right})[j]`
		)
	};
}

function normalize(x: string, y: string, context: string): Guide {
	return {
		forward: explain(
			`${context} ${term('rmsNorm', 'RMSNorm')} finds one scale for all coordinates at this position and divides each coordinate by it.`,
			`D is the number of coordinates in ${x}. Squaring captures the magnitude of both positive and negative values. Adding ε = 10⁻⁵ keeps the divisor positive even for an all-zero input.`,
			`s ← square root of (mean of squared coordinates of ${x} + ε)\nfor each j: ${y}[j] ← ${x}[j] / s\nreturn ${y}`
		),
		reverse: explain(
			`Changing one coordinate of ${x} affects its own numerator and the shared divisor of all outputs. Include both contributions.`,
			's is the forward-pass divisor and D is the input width. The first term follows the direct path through the numerator. The scalar c collects contributions through the divisor.',
			`read the saved input ${x} and divisor s\nc ← mean of g(${y})[k] · ${x}[k]\nfor each j:\n    add g(${y})[j] / s − ${x}[j] · c / s³ to g(${x})[j]`
		)
	};
}

function linear(w: string, x: string, y: string, purpose: string): Guide {
	return {
		forward: explain(
			purpose,
			`Row i of ${w} defines one output coordinate. Column j corresponds to an input coordinate. The row and input have the same length. Their ${term('dotProduct', 'dot product')} adds the weighted inputs.`,
			`for each row i of ${w}:\n    total ← 0\n    for each column j: total ← total + ${w}[i, j] · ${x}[j]\n    ${y}[i] ← total\nreturn ${y}`
		),
		reverse: explain(
			`Each weight in ${w} connected an input in ${x} to an output in ${y}. Compute the contribution to the input to continue the backward pass, and accumulate the contribution to the weight for the update.`,
			`Sum over outputs i for each input j. This multiplies the output gradient by the ${term('transpose', 'transposed matrix')}. For a weight, multiply by the input saved on the forward pass. The same matrix serves every position, so their weight gradients accumulate.`,
			`for each output i and input j:\n    add ${w}[i, j] · g(${y})[i] to g(${x})[j]\n    add ${x}[j] · g(${y})[i] to g(${w})[i, j]`
		)
	};
}

function softmax(x: string, y: string, purpose: string, indices: string): Guide {
	return {
		forward: explain(
			purpose,
			`Indices i and k run over ${indices}. The ${term('exponential', 'exponential')} turns scores into positive numbers. Subtracting the maximum keeps each exponential at or below one. The common factor exp(−M) cancels during division. The resulting shares sum to one.`,
			`M ← largest score\nfor each i: a[i] ← exp(${x}[i] − M)\nS ← sum of a\nfor each i: ${y}[i] ← a[i] / S\nreturn ${y}`
		),
		reverse: explain(
			`All ${term('softmax', 'softmax')} outputs share one denominator. Changing one score changes the other shares, so its gradient depends on all the output gradients.`,
			`c is the average incoming gradient weighted by the forward shares ${y}. Compute it once over ${indices}.`,
			`c ← sum of ${y}[k] · g(${y})[k]\nfor each i:\n    add ${y}[i] · (g(${y})[i] − c) to g(${x})[i]`
		)
	};
}

const guides: Record<GuideId, Guide> = {
	symbol: {
		forward: explain(
			'Select the character read at position t. A start marker supplies the input for predicting the first letter.',
			`Letters and ${term('position', 'positions')} are indexed from zero. Because of the start marker, the first letter enters at position 1. The last letter supplies the input for predicting the end marker.`,
			'split the word into letters\nif t = 0: return the start marker\notherwise: return letter[t − 1]',
			'symbol(t) = start marker if t = 0\nsymbol(t) = letter[t − 1] if t > 0'
		)
	},
	token: {
		forward: explain(
			`Each letter of the training alphabet is one ${term('token', 'token')}. The alphabet is the sorted set of distinct letters in the corpus. Look up the letter in that list.`,
			`One additional ${term('id', 'ID')} represents the word boundary. The numeric ID selects a row of E in the next block.`,
			'if the input is a boundary: return the boundary ID\nscan the alphabet in order\nreturn the index of the matching letter',
			'id(letter) = index in the alphabet\nid(boundary) = number of letters in the alphabet'
		)
	},
	place: {
		forward: explain(
			`Pass on the input index for the current word. It selects the ${term('positionEmbedding', 'position vector')} in P.`,
			'N counts predictions, including the end marker. Counting starts again for every word. The same letter at two positions has two different position indices.',
			'start at zero on the start marker\npass the current index t to P\nincrement t for the next input'
		)
	},
	embedding: lookup('E'),
	position: lookup('P'),
	combined: addition(
		'e',
		'p',
		'x',
		`Add the ${term('tokenEmbedding', 'character embedding')} e and the ${term('positionEmbedding', 'position embedding')} p. The result describes both the letter and its place in the word.`
	),
	input: normalize(
		'x',
		'b',
		'At the transformer input, normalize the sum of the embeddings. The result b feeds attention and its residual branch.'
	),
	normalized: normalize(
		'b',
		'u',
		'Normalize b before computing the query, key and value. All three projections read the resulting u.'
	),
	query: linear(
		'Wq',
		'u',
		'Q',
		`Wq maps the current input to a ${term('qkv', 'query Q')}. Its coordinates are compared with available keys to determine how much attention each position receives.`
	),
	key: linear(
		'Wk',
		'u',
		'K',
		`Wk computes the ${term('qkv', 'key K')} for this position. Store it with earlier keys so queries at this or a later position can use it.`
	),
	value: linear(
		'Wv',
		'u',
		'V',
		`Wv computes the ${term('qkv', 'value V')}, the information this position can pass on. Attention determines its share in the mixture.`
	),
	rawScores: {
		forward: explain(
			`Each ${term('head', 'attention head')} compares its slice of the current query with the matching slice of every available key, from the start up to the current position.`,
			`t is the current position, s is the key position and j runs over coordinates within this head. The ${term('dotProduct', 'dot product')} gives one similarity score per pair. Larger scores receive larger shares after softmax.`,
			'take the query coordinates for this head\nfor each available position s:\n    multiply matching coordinates of Q and K[s]\n    store the sum of products in r[s]'
		),
		reverse: explain(
			'Each score used one query and one key. The query took part in every comparison for this head. The same key may also serve queries at later positions.',
			'The key scales the contribution to the query, and the query scales the contribution to the key. Contributions from repeated uses accumulate.',
			'for each position s and head coordinate j:\n    add g(r)[s] · K[s, j] to g(Q)[j]\n    add g(r)[s] · Q[j] to g(K)[s, j]'
		)
	},
	scores: {
		forward: explain(
			'Divide each similarity score by the square root of the head width. This keeps scores from growing too large as more products are added.',
			'd is the number of query coordinates in one head. Index i selects an available position. The positive divisor preserves the ranking of scores.',
			'compute √d\nfor each i: s[i] ← r[i] / √d\npass s to softmax'
		),
		reverse: explain(
			'The divisor is fixed by the head width. An input change is scaled by the same factor on its way to the output.',
			'Each output score depends only on its matching input score.',
			'for each i:\n    add g(s)[i] / √d to g(r)[i]'
		)
	},
	attention: softmax(
		's',
		'α',
		`Within each head, ${term('softmax', 'softmax')} turns the similarity scores for one query into attention shares. Each share controls the contribution of the corresponding value vector.`,
		'the available positions in one head'
	),
	mix: {
		forward: explain(
			`Combine available values V using the ${term('attentionWeights', 'attention shares')} α. Larger shares give their values more influence.`,
			's indexes source positions and j indexes coordinates in the head. All coordinates from one position use the same share.',
			'for each head coordinate j:\n    multiply V[s, j] by α[s] at each position s\n    sum the products into m[j]'
		),
		reverse: explain(
			'A value receives a gradient scaled by its share. A share receives contributions from every coordinate it multiplied.',
			'Several queries can use the same value. Each adds its contribution to the gradient at that position in V.',
			'for each s and j:\n    add α[s] · g(m)[j] to g(V)[s, j]\n    add V[s, j] · g(m)[j] to g(α)[s]'
		)
	},
	merged: {
		forward: explain(
			`Concatenate the ${term('head', 'attention head')} results into a single vector, keeping the coordinate order within each head.`,
			'h is the zero-based head index, d is its width and j is the coordinate within it. The output c contains every coordinate of every head.',
			'for each head h in order:\n    append its coordinates to c\nreturn c'
		),
		reverse: explain(
			'Each coordinate came from exactly one head. Send its gradient back to the same index in that head.',
			'The first d coordinates belong to the first head, the next d to the second, and so on.',
			'for each head h:\n    take d gradients starting at h · d\n    send them to the corresponding coordinates of that head'
		)
	},
	projected: linear(
		'O',
		'c',
		'v',
		'The output matrix O mixes coordinates from all heads. Any head can contribute to any output coordinate. The result v is added to the attention input.'
	),
	attended: addition(
		'b',
		'v',
		'a',
		`The ${term('residual', 'residual connection')} carries the original attention input b. The other branch carries the attention update v. Their sum a enters the ${term('mlp', 'MLP')}.`
	),
	mlpInput: normalize(
		'a',
		'n',
		`Normalize the attention output a before the first ${term('mlp', 'MLP')} layer. A residual branch also carries a directly to the output sum.`
	),
	expanded: linear(
		'W₁',
		'n',
		'z',
		`The first ${term('mlp', 'MLP')} layer expands the input. W₁ has four times as many rows as columns. Each row defines a feature combination that will pass through ReLU.`
	),
	activated: {
		forward: explain(
			`${term('relu', 'ReLU')} acts on each coordinate independently. Positive inputs pass through and negative inputs become zero. This lets the MLP perform a nonlinear transformation.`,
			'z comes from the expanding layer and r feeds the contracting layer. Only the sign of this coordinate determines the result.',
			'for each j:\n    if z[j] > 0: r[j] ← z[j]\n    otherwise: r[j] ← 0'
		),
		reverse: explain(
			'ReLU has slope one on its positive branch, so the full gradient passes through. The negative branch is constant. At zero the model also uses slope zero.',
			'Use the sign of the input z saved during the forward pass.',
			'for each j:\n    if z[j] > 0: add g(r)[j] to g(z)[j]\n    otherwise: contribute zero',
			'g(z)[j] += g(r)[j] if z[j] > 0\ncontribution = 0 if z[j] ≤ 0'
		)
	},
	contracted: linear(
		'W₂',
		'r',
		'c₂',
		'The second MLP layer combines the active features after ReLU and returns to the width of the block input, ready for coordinate-wise addition.'
	),
	hidden: addition(
		'a',
		'c₂',
		'h',
		`The ${term('residual', 'residual connection')} carries the MLP input a and the other branch carries the change c₂. Their sum h is the position representation used to score the next character.`
	),
	logits: linear(
		'W',
		'h',
		'z',
		`The output matrix W has one row per vocabulary character, including the boundary. Its dot product with h gives the candidate’s ${term('logit', 'logit')}, the score before probabilities are computed.`
	),
	probabilities: softmax(
		'z',
		'p',
		`${term('softmax', 'Softmax')} turns candidate scores into probabilities for the next character. Training uses the probability assigned to the correct answer.`,
		'vocabulary characters'
	),
	argmax: {
		forward: explain(
			'Find the most probable next character, including the end marker. The prediction card shows that character and its probability.',
			`k is the ${term('id', 'vocabulary index')}. Ties go to the lowest index. The neighboring branch uses the probability of the actual next character to calculate the ${term('loss', 'training loss')}.`,
			'select the first vocabulary entry\nfor each remaining entry:\n    if its probability is higher, select it\nreturn the selected character and its probability'
		)
	},
	target: {
		forward: explain(
			`The word supplies the correct next character at each position. Use its ${term('id', 'ID')} to select a probability. After the last letter the target is the end marker.`,
			'k is the target ID, p is the vocabulary distribution and p* is the single probability of the target.',
			'read the next character ID from the training sequence\nselect p at that ID\npass this probability to the logarithm'
		),
		reverse: explain(
			'Only the selected probability entered the logarithm. Send the incoming gradient to the coordinate for the correct character. Softmax then connects that coordinate to every score.',
			'k was saved during the forward pass. The contribution from this operation to every other coordinate of p is zero.',
			'read the saved target ID k\nadd the gradient of the selected probability to g(p)[k]'
		)
	},
	log: {
		forward: explain(
			`Compute the ${term('logarithm', 'natural logarithm')} of the target probability. A very small probability gives a large negative logarithm. The next operation negates it to get the ${term('loss', 'loss')}.`,
			'ln uses base e and takes a positive probability. When the probability is one, the result is zero.',
			'read target probability p*\ncompute l ← ln(p*)\npass l to the negation block'
		),
		reverse: explain(
			'The slope of the natural logarithm at p* is its reciprocal. Changes to a small probability have a larger effect on its logarithm.',
			'Use the positive forward-pass probability p*. Dividing by it preserves the sign of the incoming gradient.',
			'read the saved p*\ndivide g(l) by p*\nadd the result to g(p*)'
		)
	},
	loss: {
		forward: explain(
			`Negation converts the log probability into the ${term('loss', 'prediction loss')} for one position. A higher probability for the correct answer gives a smaller loss.`,
			'l is the logarithm and ℓ is the loss at one position. These losses are collected over the word.',
			'read the log probability l\nreturn its negative'
		),
		reverse: explain(
			'Increasing l decreases the loss ℓ by the same amount. The derivative is minus one.',
			'The gradient from the mean changes sign on its way to the logarithm.',
			'negate the incoming g(ℓ)\nadd the result to g(l)'
		)
	},
	mean: {
		forward: explain(
			`One training step includes every prediction for the word, from its first letter to the end marker. Average their ${term('loss', 'losses')} into the single value L used for the backward pass.`,
			'N is the number of predictions and t indexes the positions. Every position has the same share of the mean.',
			'collect the losses at all positions\nsum them and divide by N\nreturn the mean L'
		),
		reverse: explain(
			`${term('backpropagation', 'Backpropagation')} starts at L. The derivative of L with respect to itself is one. Averaging sends an equal share of this gradient to each position.`,
			'The paths from different positions pass through shared weights. Their gradients accumulate before the single update for the word.',
			'start with g(L) ← 1\nfor each position t:\n    add g(L) / N to the gradient of ℓ[t]'
		)
	},
	adam: {
		forward: explain(
			`${term('adam', 'Adam')} updates each trainable weight after the backward pass accumulates its ${term('gradient', 'gradient')} over the word. It keeps two moving averages per weight between steps, one for the gradient m and one for its square v.`,
			'g is one weight’s gradient and k is the step number, starting at one. β₁ = 0.85 and β₂ = 0.99 control how long the moving averages retain past values. The learning rate η starts at 0.004 and gradually decreases. ε = 10⁻⁸ protects the denominator. The powers of β correct for starting both averages at zero.',
			'for each weight w:\n    read its accumulated gradient g\n    update moving averages m and v\n    correct both averages for step k\n    subtract the calculated update from w\n    keep w, m and v for the next step'
		)
	}
};

export function englishOperationExplanation(id: GuideId, backward: boolean) {
	const guide = guides[id];
	const text = backward ? guide.reverse : guide.forward;
	if (!text) throw new Error('No backward pass for ' + id);
	const formula =
		text.formula ?? operationExplanation(id, backward).formula.replace('0,004', '0.004');
	return { ...text, formula };
}
