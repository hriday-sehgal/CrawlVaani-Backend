import natural from 'natural';

function analyzeKeywords(text, limit = 20) {
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(text.toLowerCase());
  const freq = {};
  words.forEach(word => {
    if (!freq[word]) freq[word] = 0;
    freq[word]++;
  });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, count }));
}

export default analyzeKeywords;
