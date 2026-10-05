// Complete, independent learner programs for every Functions lesson.
// Correct approaches vary their algorithms; incorrect programs violate one
// stated outcome or type relationship. No fixture relies on the solution file.
function mainProgram(definitions) {
  return `module Main where\n\n${definitions.trim()}\n\nmain :: IO ()\nmain = print ()\n`;
}

module.exports = [
  {
    key: 'map-filter',
    correct: [
      {
        name: 'selection followed by mapping',
        source: mainProgram(String.raw`
qualifiedScores :: [Int] -> [Int]
qualifiedScores scores = map (\score -> score * 2) (filter (\score -> score >= 10) scores)
`),
      },
      {
        name: 'recursive selection and transformation',
        source: mainProgram(String.raw`
qualifiedScores :: [Int] -> [Int]
qualifiedScores [] = []
qualifiedScores (score:scores)
  | score >= 10 = (score * 2) : qualifiedScores scores
  | otherwise = qualifiedScores scores
`),
      },
    ],
    incorrect: [
      {
        name: 'strict cutoff excludes exactly ten',
        source: mainProgram(String.raw`
qualifiedScores :: [Int] -> [Int]
qualifiedScores scores = map (\score -> score * 2) (filter (\score -> score > 10) scores)
`),
      },
      {
        name: 'doubling makes an ineligible original score qualify',
        source: mainProgram(String.raw`
qualifiedScores :: [Int] -> [Int]
qualifiedScores scores = filter (\score -> score >= 10) (map (\score -> score * 2) scores)
`),
      },
      {
        name: 'prepending a fold result reverses input order',
        source: mainProgram(String.raw`
qualifiedScores :: [Int] -> [Int]
qualifiedScores = foldl collect []
  where
    collect result score
      | score >= 10 = (score * 2) : result
      | otherwise = result
`),
      },
    ],
  },
  {
    key: 'captured-settings',
    correct: [
      {
        name: 'returned lambda composes drop and take',
        source: mainProgram(String.raw`
makeWindow :: Int -> Int -> ([a] -> [a])
makeWindow start count = \items -> take count (drop start items)
`),
      },
      {
        name: 'returned lambda uses recursive skipping and collection',
        source: mainProgram(String.raw`
makeWindow :: Int -> Int -> ([a] -> [a])
makeWindow start count = \items -> collect count (skip start items)
  where
    skip 0 items = items
    skip _ [] = []
    skip n (_:items) = skip (n - 1) items
    collect 0 _ = []
    collect _ [] = []
    collect n (item:items) = item : collect (n - 1) items
`),
      },
    ],
    incorrect: [
      {
        name: 'ignores the captured start offset',
        source: mainProgram(String.raw`
makeWindow :: Int -> Int -> ([a] -> [a])
makeWindow start count = \items -> take count items
`),
      },
      {
        name: 'bounds original input positions before dropping',
        source: mainProgram(String.raw`
makeWindow :: Int -> Int -> ([a] -> [a])
makeWindow start count = \items -> drop start (take count items)
`),
      },
      {
        name: 'mistakes zero offset for an empty window',
        source: mainProgram(String.raw`
makeWindow :: Int -> Int -> ([a] -> [a])
makeWindow start count = \items ->
  if start == 0 then [] else take count (drop start items)
`),
      },
    ],
  },
  {
    key: 'currying',
    correct: [
      {
        name: 'explicit nested lambdas configure a mapping',
        source: mainProgram(String.raw`
discountAll :: Int -> [Int] -> [Int]
discountAll = \amount -> \scores -> map (\score -> score - amount) scores
`),
      },
      {
        name: 'configured recursive worker preserves every score',
        source: mainProgram(String.raw`
discountAll :: Int -> [Int] -> [Int]
discountAll = \amount -> \scores ->
  let reduce [] = []
      reduce (score:rest) = (score - amount) : reduce rest
  in reduce scores
`),
      },
    ],
    incorrect: [
      {
        name: 'reverses subtraction operands',
        source: mainProgram(String.raw`
discountAll :: Int -> [Int] -> [Int]
discountAll amount scores = map (\score -> amount - score) scores
`),
      },
      {
        name: 'clamps negative discounted scores',
        source: mainProgram(String.raw`
discountAll :: Int -> [Int] -> [Int]
discountAll amount scores = map (\score -> max 0 (score - amount)) scores
`),
      },
      {
        name: 'hard codes the sample discount instead of capturing it',
        source: mainProgram(String.raw`
discountAll :: Int -> [Int] -> [Int]
discountAll amount scores = map (\score -> score - 10) scores
`),
      },
    ],
  },
  {
    key: 'higher-order-types',
    correct: [
      {
        name: 'maps a polymorphic pair transformation',
        source: mainProgram(String.raw`
convertPairs :: (a -> b) -> [(tag, a)] -> [(tag, b)]
convertPairs convert = map (\(label, value) -> (label, convert value))
`),
      },
      {
        name: 'recurses without comparisons or type constraints',
        source: mainProgram(String.raw`
convertPairs :: (a -> b) -> [(tag, a)] -> [(tag, b)]
convertPairs _ [] = []
convertPairs convert ((label, value):rest) =
  (label, convert value) : convertPairs convert rest
`),
      },
    ],
    incorrect: [
      {
        name: 'converts only the first pair',
        source: mainProgram(String.raw`
convertPairs :: (a -> b) -> [(tag, a)] -> [(tag, b)]
convertPairs _ [] = []
convertPairs convert ((label, value):rest) = [(label, convert value)]
`),
      },
      {
        name: 'prepends conversions and reverses their order',
        source: mainProgram(String.raw`
convertPairs :: (a -> b) -> [(tag, a)] -> [(tag, b)]
convertPairs convert = foldl (\result (label, value) -> (label, convert value) : result) []
`),
      },
      {
        name: 'adds an unnecessary equality constraint to labels',
        gateErrorExpected: true,
        source: mainProgram(String.raw`
convertPairs :: Eq tag => (a -> b) -> [(tag, a)] -> [(tag, b)]
convertPairs convert = map (\(label, value) -> (label, convert value))
`),
      },
    ],
  },
  {
    key: 'left-folds',
    correct: [
      {
        name: 'left fold extends the decimal prefix',
        source: mainProgram(String.raw`
digitsToNumber :: [Integer] -> Integer
digitsToNumber = foldl (\prefix digit -> prefix * 10 + digit) 0
`),
      },
      {
        name: 'recursive helper carries the decimal prefix',
        source: mainProgram(String.raw`
digitsToNumber :: [Integer] -> Integer
digitsToNumber = collect 0
  where
    collect prefix [] = prefix
    collect prefix (digit:digits) = collect (prefix * 10 + digit) digits
`),
      },
    ],
    incorrect: [
      {
        name: 'adds digits without shifting place value',
        source: mainProgram(String.raw`
digitsToNumber :: [Integer] -> Integer
digitsToNumber = foldl (\prefix digit -> prefix + digit) 0
`),
      },
      {
        name: 'assigns increasing place values from the left',
        source: mainProgram(String.raw`
digitsToNumber :: [Integer] -> Integer
digitsToNumber digits = collect 1 digits
  where
    collect _ [] = 0
    collect place (digit:rest) = digit * place + collect (place * 10) rest
`),
      },
      {
        name: 'narrows the supplied Integer interface to machine Int',
        gateErrorExpected: true,
        source: mainProgram(String.raw`
digitsToNumber :: [Int] -> Int
digitsToNumber = foldl (\prefix digit -> prefix * 10 + digit) 0
`),
      },
    ],
  },
  {
    key: 'recursive-accumulators',
    correct: [
      {
        name: 'guarded recursion updates one count per item',
        source: mainProgram(String.raw`
tallyFrom :: (Int, Int) -> (a -> Bool) -> [a] -> (Int, Int)
tallyFrom counts _ [] = counts
tallyFrom (yes, no) predicate (item:rest)
  | predicate item = tallyFrom (yes + 1, no) predicate rest
  | otherwise = tallyFrom (yes, no + 1) predicate rest
`),
      },
      {
        name: 'captured predicate and Boolean update helper',
        source: mainProgram(String.raw`
tallyFrom :: (Int, Int) -> (a -> Bool) -> [a] -> (Int, Int)
tallyFrom initial predicate = walk initial
  where
    walk counts [] = counts
    walk counts (item:rest) = walk (advance counts (predicate item)) rest
    advance (yes, no) True = (yes + 1, no)
    advance (yes, no) False = (yes, no + 1)
`),
      },
    ],
    incorrect: [
      {
        name: 'discards the supplied counts',
        source: mainProgram(String.raw`
tallyFrom :: (Int, Int) -> (a -> Bool) -> [a] -> (Int, Int)
tallyFrom initial predicate items = walk (0,0) items
  where
    walk counts [] = counts
    walk (yes, no) (item:rest)
      | predicate item = walk (yes + 1, no) rest
      | otherwise = walk (yes, no + 1) rest
`),
      },
      {
        name: 'increments both categories for a failed item',
        source: mainProgram(String.raw`
tallyFrom :: (Int, Int) -> (a -> Bool) -> [a] -> (Int, Int)
tallyFrom counts _ [] = counts
tallyFrom (yes, no) predicate (item:rest)
  | predicate item = tallyFrom (yes + 1, no) predicate rest
  | otherwise = tallyFrom (yes + 1, no + 1) predicate rest
`),
      },
      {
        name: 'requires equality even though only the predicate observes items',
        gateErrorExpected: true,
        source: mainProgram(String.raw`
tallyFrom :: Eq a => (Int, Int) -> (a -> Bool) -> [a] -> (Int, Int)
tallyFrom counts _ [] = counts
tallyFrom (yes, no) predicate (item:rest)
  | predicate item = tallyFrom (yes + 1, no) predicate rest
  | otherwise = tallyFrom (yes, no + 1) predicate rest
`),
      },
    ],
  },
  {
    key: 'lazy-lists',
    correct: [
      {
        name: 'take consumes matching outputs incrementally',
        source: mainProgram(String.raw`
firstMatches :: Int -> (a -> Bool) -> [a] -> [a]
firstMatches count predicate items = take count (filter predicate items)
`),
      },
      {
        name: 'recursive search decrements only after a match',
        source: mainProgram(String.raw`
firstMatches :: Int -> (a -> Bool) -> [a] -> [a]
firstMatches 0 _ _ = []
firstMatches _ _ [] = []
firstMatches count predicate (item:rest)
  | predicate item = item : firstMatches (count - 1) predicate rest
  | otherwise = firstMatches count predicate rest
`),
      },
    ],
    incorrect: [
      {
        name: 'bounds input positions before selecting matches',
        source: mainProgram(String.raw`
firstMatches :: Int -> (a -> Bool) -> [a] -> [a]
firstMatches count predicate items = filter predicate (take count items)
`),
      },
      {
        name: 'fold prepending reverses the bounded matching result',
        source: mainProgram(String.raw`
firstMatches :: Int -> (a -> Bool) -> [a] -> [a]
firstMatches count predicate items =
  foldl (\result item -> item : result) [] (take count (filter predicate items))
`),
      },
      {
        name: 'adds equality to a predicate-only selection interface',
        gateErrorExpected: true,
        source: mainProgram(String.raw`
firstMatches :: Eq a => Int -> (a -> Bool) -> [a] -> [a]
firstMatches count predicate items = take count (filter predicate items)
`),
      },
    ],
  },
  {
    key: 'deferred-work',
    correct: [
      {
        name: 'a guard-only first equation falls through to the list cases',
        source: mainProgram(String.raw`
queueForRide :: Int -> Int -> [Int] -> Int
queueForRide ride queued songs
  | queued >= ride = queued
queueForRide ride queued [] = queued
queueForRide ride queued (song:rest) = queueForRide ride (queued + song) rest
`),
      },
      {
        name: 'guards test emptiness only after the ride check',
        source: mainProgram(String.raw`
queueForRide :: Int -> Int -> [Int] -> Int
queueForRide ride queued songs
  | queued >= ride = queued
  | null songs = queued
  | otherwise = queueForRide ride (queued + head songs) (tail songs)
`),
      },
      {
        name: 'the first covering running total from a lazy scan',
        source: mainProgram(String.raw`
queueForRide :: Int -> Int -> [Int] -> Int
queueForRide ride queued songs =
  case dropWhile (< ride) (scanl (+) queued songs) of
    covered:_ -> covered
    [] -> queued + sum songs
`),
      },
    ],
    incorrect: [
      {
        name: 'matches the song list before checking the ride',
        gateErrorExpected: true,
        source: mainProgram(String.raw`
queueForRide :: Int -> Int -> [Int] -> Int
queueForRide ride queued [] = queued
queueForRide ride queued (song:rest)
  | queued >= ride = queued
  | otherwise = queueForRide ride (queued + song) rest
`),
      },
      {
        name: 'caps a total of every song at the ride length',
        gateErrorExpected: true,
        source: mainProgram(String.raw`
queueForRide :: Int -> Int -> [Int] -> Int
queueForRide ride queued songs = min ride (queued + sum songs)
`),
      },
      {
        name: 'requires the queue to exceed the ride length',
        source: mainProgram(String.raw`
queueForRide :: Int -> Int -> [Int] -> Int
queueForRide ride queued songs
  | queued > ride = queued
queueForRide ride queued [] = queued
queueForRide ride queued (song:rest) = queueForRide ride (queued + song) rest
`),
      },
      {
        name: 'returns the total before the song that covers the ride',
        source: mainProgram(String.raw`
queueForRide :: Int -> Int -> [Int] -> Int
queueForRide ride queued songs
  | queued >= ride = queued
queueForRide ride queued [] = queued
queueForRide ride queued (song:rest)
  | queued + song >= ride = queued
  | otherwise = queueForRide ride (queued + song) rest
`),
      },
    ],
  },
  {
    key: 'playlist',
    correct: [
      {
        name: 'one left fold accumulates titles and total',
        source: mainProgram(String.raw`
playlistReport :: Int -> Int -> [(String, Int)] -> ([String], Int)
playlistReport cutoff bonus = foldl collect ([],0)
  where
    collect (titles,total) (title,score)
      | score >= cutoff = (titles ++ [title], total + score + bonus)
      | otherwise = (titles,total)
`),
      },
      {
        name: 'recursive selection combines the remaining report',
        source: mainProgram(String.raw`
playlistReport :: Int -> Int -> [(String, Int)] -> ([String], Int)
playlistReport _ _ [] = ([],0)
playlistReport cutoff bonus ((title,score):rest) =
  let (titles,total) = playlistReport cutoff bonus rest
  in if score >= cutoff
     then (title:titles, score + bonus + total)
     else (titles,total)
`),
      },
    ],
    incorrect: [
      {
        name: 'excludes a score exactly at the cutoff',
        source: mainProgram(String.raw`
playlistReport :: Int -> Int -> [(String, Int)] -> ([String], Int)
playlistReport cutoff bonus tracks =
  let selected = filter (\(_,score) -> score > cutoff) tracks
  in (map fst selected, foldl (\total (_,score) -> total + score + bonus) 0 selected)
`),
      },
      {
        name: 'adds the bonus once instead of per occurrence',
        source: mainProgram(String.raw`
playlistReport :: Int -> Int -> [(String, Int)] -> ([String], Int)
playlistReport cutoff bonus tracks =
  let selected = filter (\(_,score) -> score >= cutoff) tracks
      total = foldl (\points (_,score) -> points + score) 0 selected
  in (map fst selected, if null selected then 0 else total + bonus)
`),
      },
      {
        name: 'rejects empty titles even when their scores qualify',
        source: mainProgram(String.raw`
playlistReport :: Int -> Int -> [(String, Int)] -> ([String], Int)
playlistReport cutoff bonus tracks =
  let selected = filter (\(title,score) -> title /= "" && score >= cutoff) tracks
  in (map fst selected, foldl (\total (_,score) -> total + score + bonus) 0 selected)
`),
      },
    ],
  },
];
