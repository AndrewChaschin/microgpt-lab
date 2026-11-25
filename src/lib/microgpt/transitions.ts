export const transitions = [
	{ name: 'Поиск в словаре', formula: 'ID = словарь[символ]' },
	{ name: 'Сложение векторов', formula: 'xⱼ = E[id, j] + P[t, j]' },
	{ name: 'Проекции Q, K, V', formula: 'Q = WQ · u, K = WK · u, V = WV · u' },
	{ name: 'Взвешивание позиций', formula: 'α = softmax(QKᵀ / √d)' },
	{ name: 'Два линейных слоя', formula: 'h = a + W₂ · ReLU(W₁ · N(a))' },
	{ name: 'Оценки в вероятности', formula: 'p = softmax(W · h)' },
	{ name: 'Расчёт ошибки', formula: 'ℓ = −ln(p цели)' }
];
