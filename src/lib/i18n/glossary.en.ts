import type { GlossaryKey } from '~/utils/glossary';
export const englishGlossary = {
	token: {
		title: 'Token',
		description:
			'One unit of the input sequence. In this model a token is either a letter or the special word boundary marker.'
	},
	id: {
		title: 'Token ID',
		description:
			'The index of a vocabulary entry. The model uses it to look up a row of E. Each training letter and the boundary marker have their own ID. Other models can assign different IDs to the same letters.'
	},
	position: {
		title: 'Token position',
		description:
			'The index of a token in the current sequence, counted after tokenization. The first token occupies position 0 and the second occupies position 1.'
	},
	corpus: {
		title: 'Corpus',
		description:
			'A collection of texts used for training or analysis. The training corpus in this lab consists of Russian words.'
	},
	vector: {
		title: 'Vector and coordinates',
		description:
			'An ordered list of numbers. For example, [2, −1, 0] has three coordinates. A coordinate is the number at a particular index. The number of coordinates is the dimension of the vector.'
	},
	matrix: {
		title: 'Matrix',
		description:
			'A rectangular table of numbers. In E, one row contains the entire vector for one token, and each column corresponds to one coordinate.'
	},
	embedding: {
		title: 'Embedding',
		description:
			'A vector that represents an object, such as a token or its position. The model learns the numbers in these vectors during training.'
	},
	tokenEmbedding: {
		title: 'Token embedding · row of E',
		description:
			'The row of E selected by the token ID. The same ID selects the same row at every position. Each row in this model contains 16 numbers.'
	},
	positionEmbedding: {
		title: 'Position embedding · row of P',
		description:
			'The row of P selected by the position in the sequence. At the first position the model always uses row 0. In microgpt the start marker occupies that position.'
	},
	hidden: {
		title: 'Hidden representation',
		description:
			'An internal vector that describes a token at an intermediate stage. In microgpt the initial vector is the sum of rows from E and P. The transformer block then updates it using the characters read so far.'
	},
	weights: {
		title: 'Model parameters and weights',
		description:
			'Numbers adjusted during training and used when processing new inputs. For example, a weight in a linear layer controls how much one input coordinate contributes to an output coordinate.'
	},
	loss: {
		title: 'Loss function',
		description:
			'A rule that turns prediction quality into a number that training seeks to reduce. Assigning less probability to the expected character gives a larger loss.'
	},
	summation: {
		title: 'Summation · Σ',
		description:
			'The index under Σ tells you what to vary. For example, Σⱼ x[j] adds the coordinates of vector x, visiting each index j once. Other indices in the expression stay fixed.'
	},
	derivative: {
		title: 'Derivative',
		description:
			'The local rate at which an output changes with an input. If the derivative is a, a small change Δx produces an output change of approximately a · Δx. A partial derivative varies one coordinate while holding the others fixed.'
	},
	transpose: {
		title: 'Matrix transpose',
		description:
			'Interchanging rows and columns. The value at row i, column j in W appears at row j, column i in Wᵀ. The backward pass uses this arrangement to gather contributions from multiple outputs into one input coordinate.'
	},
	exponential: {
		title: 'Exponential · exp',
		description:
			'The function exp(x) = eˣ, where e is approximately 2.718. Its value is positive and increases with x. Softmax divides the exponential of each score by their total to produce shares.'
	},
	logarithm: {
		title: 'Natural logarithm · ln',
		description:
			'The number ln(p) is the power to which e must be raised to obtain p. It equals zero for p = 1 and is negative for positive probabilities below one.'
	},
	gradient: {
		title: 'Gradient',
		description:
			'The partial derivatives of the loss with respect to the coordinates of a vector or matrix. For a single number there is one derivative. The backward pass computes gradients for intermediate values and weights. The optimizer uses the weight gradients to compute an update.'
	},
	backpropagation: {
		title: 'Backpropagation',
		description:
			'A way to calculate how each weight affects the loss. Starting from the loss, it follows the network operations in reverse to reach the parameters.'
	},
	optimizer: {
		title: 'Optimizer',
		description:
			'An algorithm that updates the model weights. It uses gradients to choose the direction and size of the changes.'
	},
	block: {
		title: 'Transformer block',
		description:
			'In microgpt the block receives one vector per position. Four self-attention heads mix information from the current and previous positions. A small network (MLP) then transforms each position separately. Before each operation the model normalizes the vector. Afterward it adds the result to that operation’s original input.'
	},
	attention: {
		title: 'Self-attention',
		description:
			'A computation that lets a token use information from other tokens in the same sequence. Learned weights control how much information each available position contributes.'
	},
	head: {
		title: 'Attention head',
		description:
			'A part of the attention mechanism that compares a query with keys and mixes values using its own attention shares. Each of the four heads in microgpt works with a separate group of coordinates. The results are concatenated into one vector.'
	},
	qkv: {
		title: 'Query, key and value (Q, K, V)',
		description:
			'Three vectors computed from a token’s internal representation. A query is compared with keys to decide how much to take from each position. The value vectors contain the information being combined.'
	},
	dotProduct: {
		title: 'Dot product',
		description:
			'Multiply matching coordinates of two equal-length vectors and add the products. For [2, 1] and [3, 4], the dot product is 2 × 3 + 1 × 4 = 10.'
	},
	attentionWeights: {
		title: 'Attention weights',
		description:
			'The factors applied to value vectors before adding them. A larger weight gives that value more influence. After softmax the weights for the available positions sum to one.'
	},
	mlp: {
		title: 'Multilayer perceptron (MLP)',
		description:
			'The part of a block that transforms each token’s vector separately. In microgpt it expands the vector from 16 to 64 coordinates, applies ReLU, then projects it back to 16 coordinates.'
	},
	relu: {
		title: 'ReLU',
		description:
			'A function that passes positive numbers through and replaces negative numbers with zero. For example, −2 becomes 0 and 3 remains 3.'
	},
	rmsNorm: {
		title: 'RMSNorm',
		description:
			'A way to bring the numbers in a vector to a consistent scale. Compute the mean of the squared coordinates, add a small constant to protect against division by zero, then divide each coordinate by the square root of that result.'
	},
	adam: {
		title: 'Adam',
		description:
			'An optimizer that tracks a moving average of each weight’s gradient and squared gradient. It uses both to adapt the size of the update separately for each weight.'
	},
	logit: {
		title: 'Logit',
		description:
			'A raw score for a candidate next token. Each token has one logit, which can be any real number. Softmax converts the scores into probabilities.'
	},
	softmax: {
		title: 'Softmax',
		description:
			'A function that converts scores to shares that sum to one. A higher score gives a larger share. A score of −∞ gives a share of zero. These shares act as probabilities at the output and as weights inside attention.'
	},
	residual: {
		title: 'Residual connection',
		description:
			'A direct path for an input vector. The block adds the original input to the transformed result, carrying its information forward along with the computed change.'
	}
} satisfies Record<GlossaryKey, { title: string; description: string }>;
