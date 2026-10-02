// Complete student programs exercise each lesson's value contract. Correct cases
// vary algorithms and remove unnecessary ADT Eq/Show instances. Wrong cases are
// runnable misunderstandings, rather than malformed programs that fail to compile.
function program(declarations, definition, sample) {
  return `module Main where\n\n${declarations}\n\n${definition}\n\nmain :: IO ()\nmain = print (${sample})\n`;
}

const event = 'data Event = Travel Integer | Fight Integer | Heal Integer';
const hero = `data Hero = Hero {heroName :: String, hitPoints :: Integer}
healthOf :: Hero -> Integer
healthOf (Hero _ hp) = hp
renameHero newName (Hero _ hp) = Hero newName hp`;
const trail = `data Trail = End | Stop String Trail
toList :: Trail -> [String]
toList End = []
toList (Stop name rest) = name : toList rest`;
const trailConversions = `${trail}
fromList :: [String] -> Trail
fromList [] = End
fromList (name:rest) = Stop name (fromList rest)`;
const route = 'data Route = NoRoute | Route [String] [Route]';
const tree = `data SearchTree = Tip | Fork Integer SearchTree SearchTree
toAscList :: SearchTree -> [Integer]
toAscList Tip = []
toAscList (Fork value left right) = toAscList left ++ [value] ++ toAscList right`;
const expression = 'data Expr = Number Integer | Plus Expr Expr | Times Expr Expr';

function variants(name, definition) {
  return { name, source: program(event, 'eventDelta :: Event -> Integer\n' + definition,
    '(eventDelta (Travel 10), eventDelta (Fight 7), eventDelta (Heal 3))') };
}
function records(name, definition) {
  return { name, source: program(hero, 'healHero :: Integer -> Hero -> Hero\n' + definition,
    'healthOf (healHero 15 (Hero "Fern" 70))') };
}
function generic(name, definition) {
  return { name, source: program('', 'withinBand :: Ord a => (a, a) -> [a] -> [a]\n' + definition,
    'withinBand (2,6) [7,2,5,1,6,5] :: [Integer]') };
}
function conversion(name, definition) {
  return { name, source: program(trail, 'fromList :: [String] -> Trail\n' + definition,
    'toList (fromList ["Gate","Lake"])') };
}
function deletion(name, definition) {
  return { name, source: program(trailConversions, 'removeStop :: Int -> Trail -> Trail\n' + definition,
    'toList (removeStop 1 (fromList ["Gate","Lake","Tower"]))') };
}
function branching(name, definition) {
  return { name, source: program(route, 'countLabeled :: Route -> Int\n' + definition,
    'countLabeled (Route [] [Route ["Lake"] [], NoRoute])') };
}
function search(name, definition) {
  return { name, source: program(tree, 'removeSmallest :: SearchTree -> SearchTree\n' + definition,
    'toAscList (removeSmallest (Fork 8 (Fork 3 Tip (Fork 5 Tip Tip)) (Fork 12 Tip Tip)))') };
}
function evaluation(name, definition) {
  return { name, source: program(expression, 'eval :: Expr -> Integer\n' + definition,
    'eval (Times (Plus (Number 2) (Number 5)) (Number 4))') };
}

// These mutations change one expedition rule at a time. The absorbing result
// keeps the fold a valid alternative to the reference's recursive strategy.
function expedition(name, { threshold = 'hp <= 40', halve = true, cap = true, stop = true } = {}) {
  const definition = `journey :: [Event] -> Integer
journey = foldl advance 100
  where
    ${stop ? 'advance (-1) _ = -1' : ''}
    advance hp e =
      let next = case e of
            Travel n -> if ${threshold} then hp else ${cap ? 'min 100 (hp + n `div` 4)' : 'hp + n `div` 4'}
            Fight n -> hp - ${halve ? '(if ' + threshold + ' then n `div` 2 else n)' : 'n'}
            Heal n -> ${cap ? 'min 100 (hp + n)' : 'hp + n'}
      in if next <= 0 then -1 else next`;
  return { name, source: program(event, definition, 'journey [Fight 60, Travel 40, Heal 1, Fight 3]') };
}

module.exports = [
  {
    key: 'variants',
    correct: [
      variants('constructor equations without Show', `eventDelta (Travel n) = n \`div\` 4
eventDelta (Fight n) = negate n
eventDelta (Heal n) = n`),
      variants('case expression delegates travel arithmetic', `eventDelta e = case e of
  Travel n -> quarters n
  Fight n -> (-n)
  Heal n -> n
quarters n = div n 4`),
    ],
    incorrect: [
      variants('travel counts distance rather than whole quarters', `eventDelta (Travel n) = n
eventDelta (Fight n) = negate n
eventDelta (Heal n) = n`),
      variants('fight payload incorrectly restores health', `eventDelta (Travel n) = div n 4
eventDelta (Fight n) = n
eventDelta (Heal n) = n`),
      variants('event-level heal incorrectly applies the later health cap', `eventDelta (Travel n) = div n 4
eventDelta (Fight n) = negate n
eventDelta (Heal n) = min 100 n`),
    ],
  },
  {
    key: 'records',
    correct: [
      { name: 'constructor rebuilding without sample helpers or Eq/Show', source: program(
        'data Hero = Hero {heroName :: String, hitPoints :: Integer}',
        'healHero :: Integer -> Hero -> Hero\nhealHero amount (Hero name hp) = Hero name (min 100 (amount + hp))',
        'case healHero 15 (Hero "Fern" 70) of Hero name hp -> (name,hp)') },
      records('record update with guarded cap', `healHero amount h
  | hitPoints h + amount > 100 = h {hitPoints = 100}
  | otherwise = h {hitPoints = hitPoints h + amount}`),
    ],
    incorrect: [
      records('healing replaces the original health', 'healHero amount (Hero name _) = Hero name (min 100 amount)'),
      records('healing ignores the maximum', 'healHero amount (Hero name hp) = Hero name (hp + amount)'),
      records('reconstruction discards the original name', 'healHero amount (Hero _ hp) = Hero "Fern" (min 100 (hp + amount))'),
    ],
  },
  {
    key: 'generic-functions',
    correct: [
      generic('comprehension retains inclusive values', 'withinBand (lo,hi) xs = [x | x <- xs, lo <= x, x <= hi]'),
      generic('list recursion with inclusive guards', `withinBand _ [] = []
withinBand bounds@(lo,hi) (x:xs)
  | x >= lo && x <= hi = x : withinBand bounds xs
  | otherwise = withinBand bounds xs`),
    ],
    incorrect: [
      generic('endpoints incorrectly excluded', 'withinBand (lo,hi) = filter (\\x -> lo < x && x < hi)'),
      generic('upper bound omitted', 'withinBand (lo,hi) = filter (\\x -> lo <= x)'),
      generic('tail-first reconstruction reverses the retained order', `withinBand _ [] = []
withinBand bounds@(lo,hi) (x:xs)
  | lo <= x && x <= hi = withinBand bounds xs ++ [x]
  | otherwise = withinBand bounds xs`),
    ],
  },
  {
    key: 'recursive-data',
    correct: [
      conversion('constructor recursion without Eq or Show', `fromList [] = End
fromList (name:rest) = Stop name (fromList rest)`),
      conversion('fold builds the matching sequence', 'fromList xs = foldl (\\rest name -> Stop name rest) End (reverse xs)'),
    ],
    incorrect: [
      conversion('only the first stop is converted', `fromList [] = End
fromList (name:_) = Stop name End`),
      conversion('left fold reverses the sequence', 'fromList = foldl (\\rest name -> Stop name rest) End'),
      conversion('empty stop names silently discarded', `fromList [] = End
fromList (name:rest)
  | name == "" = fromList rest
  | otherwise = Stop name (fromList rest)`),
    ],
  },
  {
    key: 'persistent-trails',
    correct: [
      deletion('direct persistent recursion without Eq or Show', `removeStop index trail | index < 0 = trail
removeStop _ End = End
removeStop 0 (Stop _ rest) = rest
removeStop index (Stop name rest) = Stop name (removeStop (index - 1) rest)`),
      deletion('equivalent list conversion rebuilds all links', `removeStop index original
  | index < 0 = original
  | otherwise = fromList (take index values ++ drop (index + 1) values)
  where values = toList original`),
    ],
    incorrect: [
      deletion('one-based rather than zero-based removal', `removeStop index trail | index <= 0 = trail
removeStop _ End = End
removeStop 1 (Stop _ rest) = rest
removeStop index (Stop name rest) = Stop name (removeStop (index - 1) rest)`),
      deletion('all stops equal to the indexed name are removed', `removeStop index original
  | index < 0 || index >= length values = original
  | otherwise = fromList (filter (/= (values !! index)) values)
  where values = toList original`),
      deletion('out-of-range deletion incorrectly empties the trail', `removeStop index original
  | index < 0 = original
  | index >= length values = End
  | otherwise = fromList (take index values ++ drop (index + 1) values)
  where values = toList original`),
    ],
  },
  {
    key: 'branching-data',
    correct: [
      branching('sum recursive subtree counts', `countLabeled NoRoute = 0
countLabeled (Route labels children) = (if null labels then 0 else 1) + sum (map countLabeled children)`),
      branching('pending-node traversal accumulates a total', `countLabeled route = visit 0 [route]
  where
    visit total [] = total
    visit total (NoRoute:rest) = visit total rest
    visit total (Route labels children:rest) = visit (total + if null labels then 0 else 1) (children ++ rest)`),
    ],
    incorrect: [
      branching('counts labels instead of labeled nodes', `countLabeled NoRoute = 0
countLabeled (Route labels children) = length labels + sum (map countLabeled children)`),
      branching('prunes descendants of unlabeled nodes', `countLabeled NoRoute = 0
countLabeled (Route labels children)
  | null labels = 0
  | otherwise = 1 + sum (map countLabeled children)`),
      branching('counts immediate child entries without recursion', `countLabeled NoRoute = 0
countLabeled (Route labels children) = (if null labels then 0 else 1) + length children`),
      branching('mistakes an empty label for an unlabeled node', `countLabeled NoRoute = 0
countLabeled (Route labels children) = (if null (filter (/= "") labels) then 0 else 1) + sum (map countLabeled children)`),
    ],
  },
  {
    key: 'search-min-removal',
    correct: [
      { name: 'left-path reconstruction without sample observers or Eq/Show', source: program(
        'data SearchTree = Tip | Fork Integer SearchTree SearchTree',
        `removeSmallest :: SearchTree -> SearchTree
removeSmallest Tip = Tip
removeSmallest (Fork _ Tip right) = right
removeSmallest (Fork value left right) = Fork value (removeSmallest left) right`,
        'let {observe Tip = []; observe (Fork x l r) = observe l ++ [x] ++ observe r} in observe (removeSmallest (Fork 8 (Fork 3 Tip (Fork 5 Tip Tip)) (Fork 12 Tip Tip)))') },
      search('rebuilds a valid right-chain BST with different shape', `removeSmallest = rebuild . drop 1 . toAscList
  where
    rebuild [] = Tip
    rebuild (x:xs) = Fork x Tip (rebuild xs)`),
    ],
    incorrect: [
      search('nested minimum loses its surviving right child', `removeSmallest Tip = Tip
removeSmallest (Fork _ Tip _) = Tip
removeSmallest (Fork value left right) = Fork value (removeSmallest left) right`),
      search('returns the root right subtree even with a left child', `removeSmallest Tip = Tip
removeSmallest (Fork _ _ right) = right`),
      search('retains keys but rebuilds with the wrong ordering', `removeSmallest = rebuild . reverse . drop 1 . toAscList
  where
    rebuild [] = Tip
    rebuild (x:xs) = Fork x Tip (rebuild xs)`),
    ],
  },
  {
    key: 'expression-trees',
    correct: [
      evaluation('constructor equations evaluate both children', `eval (Number n) = n
eval (Plus left right) = eval left + eval right
eval (Times left right) = eval left * eval right`),
      evaluation('case expression factors the binary operation helper', `eval expression = case expression of
  Number n -> n
  Plus left right -> combine (+) left right
  Times left right -> combine (*) left right
combine operation left right = operation (eval left) (eval right)`),
    ],
    incorrect: [
      evaluation('ignores the right child', `eval (Number n) = n
eval (Plus left right) = eval left
eval (Times left right) = eval left`),
      evaluation('Times mistakenly performs addition', `eval (Number n) = n
eval (Plus left right) = eval left + eval right
eval (Times left right) = eval left + eval right`),
      evaluation('Number payloads incorrectly forced nonnegative', `eval (Number n) = abs n
eval (Plus left right) = eval left + eval right
eval (Times left right) = eval left * eval right`),
    ],
  },
  {
    key: 'expedition',
    correct: [
      { name: 'recursive transitions stop immediately at death', source: program(event, `journey :: [Event] -> Integer
journey events = process 100 events
  where
    process hp [] = hp
    process hp (event:rest) =
      let next = case event of
            Travel n -> if hp <= 40 then hp else min 100 (hp + div n 4)
            Fight n -> hp - (if hp <= 40 then div n 2 else n)
            Heal n -> min 100 (hp + n)
      in if next <= 0 then -1 else process next rest`, 'journey [Fight 60, Travel 40, Heal 1, Fight 3]') },
      expedition('fold with absorbing terminal state'),
    ],
    incorrect: [
      expedition('40 incorrectly treated as ordinary mode', { threshold: 'hp < 40' }),
      expedition('fight damage never halved in defensive mode', { halve: false }),
      expedition('later healing revives the terminal result', { stop: false }),
      expedition('restorations incorrectly ignore the cap', { cap: false }),
    ],
  },
];
