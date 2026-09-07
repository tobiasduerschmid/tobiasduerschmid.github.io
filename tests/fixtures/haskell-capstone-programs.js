// Independent implementations probe whether each exercise's gates accept
// different algorithms and reject common mistakes from its stated contract.
function budgetProgram(definition) {
  return `module Main where\ntakeBudget :: Int -> [Int] -> [Int]\n${definition}\nmain = print (takeBudget 5 [2,4,1])\n`;
}

function playlistProgram(definition) {
  return `module Main where\nplaylistReport :: Int -> Int -> [(String, Int)] -> ([String], Int)\n${definition}\nmain = print (playlistReport 5 2 [("one",5),("two",4)])\n`;
}

function journeyFold({ strictThreshold = false, alwaysHalve = false, revive = false } = {}) {
  const defensive = strictThreshold ? 'hp < 40' : 'hp <= 40';
  return `module Main where
data Event = Travel Integer | Fight Integer | Heal Integer deriving (Eq, Show)
journey :: [Event] -> Integer
journey = foldl advance 100
  where
    ${revive ? '' : 'advance (-1) _ = -1'}
    advance hp event =
      let next = case event of
            Fight n -> hp - (if ${alwaysHalve ? 'True' : defensive} then n \`div\` 2 else n)
            Travel n -> if ${defensive} then hp else min 100 (hp + n \`div\` 4)
            Heal n -> min 100 (hp + n)
      in if next <= 0 then -1 else next
main = print (journey [Fight 60, Heal 1, Fight 3])
`;
}

module.exports = {
  haskell: [
    {
      name: 'cumulative totals and takeWhile', passes: true,
      source: budgetProgram('takeBudget b xs = map fst (takeWhile ((<= b) . snd) (zip xs (tail (scanl (+) 0 xs))))'),
    },
    {
      name: 'tail recursion with an accumulated prefix', passes: true,
      source: budgetProgram(`takeBudget budget costs = collect budget [] costs
  where
    collect _ bought [] = reverse bought
    collect cash bought (price:rest)
      | price > cash = reverse bought
      | otherwise = collect (cash-price) (price:bought) rest`),
    },
    {
      name: 'individual affordability without a running total', passes: false,
      source: budgetProgram('takeBudget b xs = filter (<= b) xs'),
    },
    {
      name: 'skipping an unaffordable item instead of stopping', passes: false,
      source: budgetProgram(`takeBudget b [] = []
takeBudget b (x:xs)
  | x <= b = x : takeBudget (b-x) xs
  | otherwise = takeBudget b xs`),
    },
    {
      name: 'discarding free items when the budget reaches zero', passes: false,
      source: budgetProgram(`takeBudget b _ | b <= 0 = []
takeBudget b [] = []
takeBudget b (x:xs)
  | x <= b = x : takeBudget (b-x) xs
  | otherwise = []`),
    },
  ],
  'haskell-functions': [
    {
      name: 'one fold over titles and total together', passes: true,
      source: playlistProgram(`playlistReport cutoff bonus = foldr collect ([],0)
  where
    collect (title,score) (titles,total)
      | score >= cutoff = (title:titles,score+bonus+total)
      | otherwise = (titles,total)`),
    },
    {
      name: 'independent comprehensions for titles and score total', passes: true,
      source: playlistProgram(`playlistReport cutoff bonus tracks =
  ([title | (title,score) <- tracks, score >= cutoff],
   sum [score+bonus | (_,score) <- tracks, score >= cutoff])`),
    },
    {
      name: 'excluding a score exactly at the cutoff', passes: false,
      source: playlistProgram(`playlistReport cutoff bonus tracks =
  ([title | (title,score) <- tracks, score > cutoff],
   sum [score+bonus | (_,score) <- tracks, score > cutoff])`),
    },
    {
      name: 'using the bonus to qualify a previously ineligible track', passes: false,
      source: playlistProgram(`playlistReport cutoff bonus tracks =
  ([title | (title,score) <- tracks, score+bonus >= cutoff],
   sum [score+bonus | (_,score) <- tracks, score+bonus >= cutoff])`),
    },
    {
      name: 'adding the bonus once instead of once per selected occurrence', passes: false,
      source: playlistProgram(`playlistReport cutoff bonus tracks =
  let selected = [(title,score) | (title,score) <- tracks, score >= cutoff]
  in (map fst selected, if null selected then 0 else sum (map snd selected) + bonus)`),
    },
  ],
  'haskell-data': [
    { name: 'left fold with an absorbing death state', passes: true, source: journeyFold() },
    {
      name: 'mutually recursive normal and defensive modes', passes: true,
      source: `module Main where
data Event = Travel Integer | Fight Integer | Heal Integer deriving (Eq, Show)
journey :: [Event] -> Integer
journey = continue 100
  where
    continue hp events
      | hp <= 0 = -1
      | hp <= 40 = defensive hp events
      | otherwise = normal hp events
    normal hp [] = hp
    normal hp (Fight n:rest) = continue (hp-n) rest
    normal hp (Travel n:rest) = continue (min 100 (hp+n \`div\` 4)) rest
    normal hp (Heal n:rest) = continue (min 100 (hp+n)) rest
    defensive hp [] = hp
    defensive hp (Fight n:rest) = continue (hp-n \`div\` 2) rest
    defensive hp (Travel _:rest) = continue hp rest
    defensive hp (Heal n:rest) = continue (min 100 (hp+n)) rest
main = print (journey [Fight 60, Heal 1, Fight 3])
`,
    },
    { name: 'excluding exactly forty from defensive mode', passes: false, source: journeyFold({ strictThreshold: true }) },
    { name: 'halving damage even in normal mode', passes: false, source: journeyFold({ alwaysHalve: true }) },
    { name: 'allowing a later heal to revive a dead expedition', passes: false, source: journeyFold({ revive: true }) },
  ],
};
