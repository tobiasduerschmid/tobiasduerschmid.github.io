function program(definition) {
  return `module Main where
doubleScores :: [Int] -> [Int]
${definition}
main :: IO ()
main = print (doubleScores [1,2,3])
`;
}

module.exports = [{
  key: 'A Pure List Transformation',
  correct: [
    { name: 'mapping multiplication', source: program('doubleScores = map (*2)') },
    { name: 'recursive construction', source: program('doubleScores [] = []\ndoubleScores (x:xs) = (x+x) : doubleScores xs') },
  ],
  incorrect: [
    { name: 'assuming every list has the sample length', source: program('doubleScores [a,b,c] = [2*a,2*b,2*c]\ndoubleScores _ = []') },
    { name: 'discarding zero scores', source: program('doubleScores xs = [2*x | x <- xs, x /= 0]') },
    { name: 'reversing the result while accumulating', source: program('doubleScores = foldl (\\acc x -> (2*x):acc) []') },
  ],
}];
