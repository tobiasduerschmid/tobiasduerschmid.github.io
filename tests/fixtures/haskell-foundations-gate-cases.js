// Complete, independent programs for the foundations' public student contracts.
// Factories supply unchanged declarations/display harnesses; no program reads the
// authored solution or recognizes a table of the gate's particular examples.
function program(declarations, main) {
  return `module Main where\n\n${declarations.trim()}\n\nmain :: IO ()\nmain = ${main}\n`;
}

function variant(name, source, expectations = {}) {
  return { name, source, ...expectations };
}

function money(body) {
  return program(`
remainingMoney :: Int -> Int -> Int
remainingMoney budget spent = budget - spent
moneyLeftAfterTwoPizzas :: Int -> Int -> Int
${body}`, 'print (moneyLeftAfterTwoPizzas 45 12)');
}

function price(declaration, budget = '9.50', cost = '12.00') {
  return program(`
sampleBudget = ${budget}
samplePrice = ${cost}
${declaration}
canAffordPizza budget price = budget >= price`,
  'print (canAffordPizza sampleBudget samplePrice)');
}

const regularRewards = `matchCoins won practiceMode
  | practiceMode = 0
  | won = 12
  | otherwise = 0`;
const boundedStock = `adjustStock stock change capacity
  | stock + change < 0 = 0
  | stock + change > capacity = capacity
  | otherwise = stock + change`;

function stock(rewards, adjustment) {
  return program(`
matchCoins :: Bool -> Bool -> Int
${rewards}
adjustStock :: Int -> Int -> Int -> Int
${adjustment}`, 'do\n  print (matchCoins True False, matchCoins True True)\n  print (adjustStock 8 5 10)');
}

function bill(body) {
  return program(`snackBill :: Int -> Int -> Int -> Int\n${body}`,
    'print (snackBill 4 8 3)');
}

function bonus(body) {
  return program(`
markSeen :: (a, b) -> (a, Bool)
markSeen (value, label) = (value, True)
addBonus :: Int -> (String, Int) -> (String, Int)
${body}
original :: (String, Int)
original = ("Mina", 40)`, 'do\n  print (addBonus 5 original)\n  print original');
}

function bookend(body, signature = 'a -> [a] -> [a]') {
  return program(`bookend :: ${signature}\n${body}`,
    'do\n  print (length "tea", length ["tea"], length ([] :: [Int]))\n  print (bookend \'!\' "hi")\n  print (bookend "intro" ["song"])');
}

function swap(body, signature = '[a] -> [a]') {
  return program(`
replaceHead :: a -> [a] -> [a]
replaceHead replacement [] = []
replaceHead replacement (_:rest) = replacement : rest
swapFront :: ${signature}
${body}`, 'print (swapFront ["Ada", "Bo", "Cy"])');
}

function count(body) {
  return program(`
joinRows :: [[Int]] -> [Int]
joinRows [] = []
joinRows (row:rows) = row ++ joinRows rows
countAtLeast :: Int -> [Int] -> Int
${body}`, 'print (countAtLeast 60 [60, 59, 60])');
}

function routes(body) {
  return program(`routeCandidates :: [String] -> [Int] -> [(Int, String)]\n${body}`,
    'print (routeCandidates ["Cedar","","Bay"] [3,0,1])');
}

function budget(body) {
  return program(`takeBudget :: Int -> [Int] -> [Int]\n${body}`,
    'print (takeBudget 5 [2,4,1])');
}

module.exports = [
  {
    key: 'session-time',
    correct: [
      variant('direct total-price expression', money(
        'moneyLeftAfterTwoPizzas budget pizzaPrice = budget - 2 * pizzaPrice')),
      variant('two sequential pure subtractions', money(
        'moneyLeftAfterTwoPizzas budget pizzaPrice = remainingMoney (remainingMoney budget pizzaPrice) pizzaPrice')),
    ],
    incorrect: [
      variant('multiply the remaining balance instead of the purchase', money(
        'moneyLeftAfterTwoPizzas budget pizzaPrice = remainingMoney budget pizzaPrice * 2')),
      variant('subtract the price of only one pizza', money(
        'moneyLeftAfterTwoPizzas budget pizzaPrice = budget - pizzaPrice')),
      variant('discard a negative balance instead of reporting a shortfall', money(
        'moneyLeftAfterTwoPizzas budget pizzaPrice = max 0 (budget - 2 * pizzaPrice)')),
    ],
  },
  {
    key: 'numeric-price-contract',
    correct: [
      variant('continued declaration with explicit right association', price(
        'canAffordPizza\n  :: Double\n  -> (Double -> Bool)')),
      variant('equivalent local names for the declared numeric types', price(
        'type Money = Double\ntype Decision = Bool\ncanAffordPizza :: Money -> Money -> Decision', '9.5', '12')),
    ],
    incorrect: [
      variant('numeric behavior with no explicit declaration', price(''), { gateErrorExpected: true }),
      variant('generic comparison interface instead of Double inputs', price(
        'canAffordPizza :: Ord a => a -> a -> Bool'), { gateErrorExpected: true }),
      variant('declaration exists only in comments', price(
        '-- canAffordPizza :: Double -> Double -> Bool\n{- canAffordPizza :: Double -> Double -> Bool -}'), { gateErrorExpected: true }),
      variant('round the supplied sample budget down to a whole amount', price(
        'canAffordPizza :: Double -> Double -> Bool', '9', '12')),
    ],
  },
  {
    key: 'stock-adjustment',
    correct: [
      variant('nested conditions for rewards and inventory', stock(
        'matchCoins won practiceMode = if practiceMode then 0 else if won then 12 else 0',
        'adjustStock stock change capacity = if stock + change < 0 then 0 else if stock + change > capacity then capacity else stock + change')),
      variant('combined reward condition and min/max clamp', stock(
        'matchCoins won practiceMode = if won && not practiceMode then 12 else 0',
        'adjustStock stock change capacity = min capacity (max 0 (stock + change))')),
    ],
    incorrect: [
      variant('a victory takes priority over practice mode', stock(
        'matchCoins won practiceMode\n  | won = 12\n  | practiceMode = 0\n  | otherwise = 0', boundedStock)),
      variant('every negative change empties the backpack', stock(regularRewards,
        'adjustStock stock change capacity = if change < 0 then 0 else min capacity (stock + change)')),
      variant('check the old stock before adding the change', stock(regularRewards,
        'adjustStock stock change capacity\n  | stock < 0 = 0\n  | stock > capacity = capacity\n  | otherwise = stock + change')),
      variant('use the worked-example upper limit for other capacities', stock(regularRewards,
        'adjustStock stock change capacity\n  | stock + change < 0 = 0\n  | stock + change > capacity = 10\n  | otherwise = stock + change')),
    ],
  },
  {
    key: 'local-bindings',
    correct: [
      variant('let group with the result after in', bill(`
snackBill count unitCost fee =
  let subtotal = count * unitCost
      discount = if count >= 4 then subtotal \`div\` 4 else 0
  in subtotal - discount + fee`)),
      variant('reordered where group and guards', bill(`
snackBill count unitCost fee
  | count < 4 = subtotal + fee
  | otherwise = subtotal - discount + fee
  where
    discount = subtotal \`div\` 4
    subtotal = count * unitCost`)),
    ],
    incorrect: [
      variant('eligibility depends on subtotal rather than number of snacks', bill(`
snackBill count unitCost fee = subtotal - discount + fee
  where
    subtotal = count * unitCost
    discount = if subtotal >= 32 then subtotal \`div\` 4 else 0`)),
      variant('exactly four snacks miss a strict threshold', bill(`
snackBill count unitCost fee = subtotal - discount + fee
  where
    subtotal = count * unitCost
    discount = if count > 4 then subtotal \`div\` 4 else 0`)),
      variant('round the final discounted price down rather than the discount', bill(`
snackBill count unitCost fee = if count >= 4 then subtotal * 3 \`div\` 4 + fee else subtotal + fee
  where subtotal = count * unitCost`)),
      variant('charge a delivery fee for each snack', bill(`
snackBill count unitCost fee = subtotal - discount + count * fee
  where
    subtotal = count * unitCost
    discount = if count >= 4 then subtotal \`div\` 4 else 0`)),
    ],
  },
  {
    key: 'tuples',
    correct: [
      variant('decompose the pair with fst and snd', bonus(
        'addBonus bonus entry = (fst entry, snd entry + bonus)')),
      variant('pattern and named updated score', bonus(
        'addBonus bonus (name, score) = (name, updatedScore)\n  where updatedScore = bonus + score')),
    ],
    incorrect: [
      variant('a zero bonus resets the score', bonus(
        'addBonus bonus (name, score) = (name, if bonus == 0 then 0 else score + bonus)')),
      variant('an empty name resets the entry', bonus(
        'addBonus bonus (name, score) = if null name then (name, 0) else (name, score + bonus)')),
      variant('clamp the updated score to zero', bonus(
        'addBonus bonus (name, score) = (name, max 0 (score + bonus))')),
      variant('subtract every bonus instead of adding its signed value', bonus(
        'addBonus bonus (name, score) = (name, score - bonus)')),
    ],
  },
  {
    key: 'lists',
    correct: [
      variant('concatenate two singleton bookends', bookend(
        'bookend item items = [item] ++ items ++ [item]')),
      variant('recursively append the final element after constructing the front', bookend(`
bookend item items = item : appendEnd items
  where
    appendEnd [] = [item]
    appendEnd (x:xs) = x : appendEnd xs`)),
    ],
    incorrect: [
      variant('add only the front bookend', bookend(
        'bookend item items = item : items')),
      variant('reverse the original items between the bookends', bookend(
        'bookend item items = item : (reverse items ++ [item])')),
      variant('empty input gets only one bookend', bookend(
        'bookend item [] = [item]\nbookend item items = item : (items ++ [item])')),
      variant('unnecessary equality test narrows the arbitrary element interface', bookend(
        'bookend item items = if item == item then item : (items ++ [item]) else items',
        'Eq a => a -> [a] -> [a]'), { gateErrorExpected: true }),
    ],
  },
  {
    key: 'swap-front',
    correct: [
      variant('reverse only the two-element prefix', swap(
        'swapFront values = reverse (take 2 values) ++ drop 2 values')),
      variant('check for empty tails before accessing the first two elements', swap(
        'swapFront values = if null values then values else if null (tail values) then values else head (tail values) : head values : drop 2 values')),
    ],
    incorrect: [
      variant('an exact two-element pattern misses longer lists', swap(
        'swapFront [x,y] = [y,x]\nswapFront values = values')),
      variant('swap every adjacent pair instead of just the front', swap(
        'swapFront [] = []\nswapFront [x] = [x]\nswapFront (x:y:rest) = y : x : swapFront rest')),
      variant('discard the remaining tail after the swap', swap(
        'swapFront [] = []\nswapFront [x] = [x]\nswapFront (x:y:rest) = [y,x]')),
      variant('unnecessary equality test narrows the arbitrary element interface', swap(
        'swapFront [] = []\nswapFront [x] = [x]\nswapFront (x:y:rest) = if x == x then y : x : rest else rest',
        'Eq a => [a] -> [a]'), { gateErrorExpected: true }),
    ],
  },
  {
    key: 'recursion',
    correct: [
      variant('guards combine a qualifying head with the count of its tail', count(`
countAtLeast threshold [] = 0
countAtLeast threshold (score:rest)
  | score >= threshold = 1 + countAtLeast threshold rest
  | otherwise = countAtLeast threshold rest`)),
      variant('tail-recursive count with a separate accumulator', count(`
countAtLeast threshold scores = tally 0 scores
  where
    tally total [] = total
    tally total (score:rest) = tally (total + (if score >= threshold then 1 else 0)) rest`)),
    ],
    incorrect: [
      variant('exclude scores equal to the target', count(`
countAtLeast threshold [] = 0
countAtLeast threshold (score:rest) = (if score > threshold then 1 else 0) + countAtLeast threshold rest`)),
      variant('stop at the first score below the target', count(`
countAtLeast threshold [] = 0
countAtLeast threshold (score:rest) = if score >= threshold then 1 + countAtLeast threshold rest else 0`)),
      variant('compare magnitudes instead of signed scores', count(`
countAtLeast threshold [] = 0
countAtLeast threshold (score:rest) = (if abs score >= abs threshold then 1 else 0) + countAtLeast threshold rest`)),
      variant('count each qualifying score value only once', count(`
countAtLeast threshold [] = 0
countAtLeast threshold (score:rest) = contribution + countAtLeast threshold rest
  where contribution = if score >= threshold && not (score \`elem\` rest) then 1 else 0`)),
    ],
  },
  {
    key: 'route-candidates',
    correct: [
      variant('filter each source before combining the generators', routes(`
routeCandidates routes platforms = [(platform, route) | route <- validRoutes, platform <- validPlatforms]
  where
    validRoutes = [route | route <- routes, not (null route)]
    validPlatforms = [platform | platform <- platforms, platform > 0]`)),
      variant('nested structural recursion preserves the two input orders', routes(`
routeCandidates [] platforms = []
routeCandidates (route:rest) platforms
  | null route = routeCandidates rest platforms
  | otherwise = forRoute route platforms ++ routeCandidates rest platforms
  where
    forRoute route [] = []
    forRoute route (platform:remaining)
      | platform > 0 = (platform, route) : forRoute route remaining
      | otherwise = forRoute route remaining`)),
    ],
    incorrect: [
      variant('platform-first generators give the right pairs in the wrong order', routes(
        'routeCandidates routes platforms = [(platform, route) | platform <- platforms, route <- routes, not (null route), platform > 0]')),
      variant('pair positions rather than enumerate combinations', routes(
        'routeCandidates routes platforms = [(platform, route) | (route, platform) <- zip routes platforms, not (null route), platform > 0]')),
      variant('remove repeated route entries', routes(`
routeCandidates routes platforms = [(platform, route) | route <- unique routes, platform <- platforms, not (null route), platform > 0]
  where
    unique [] = []
    unique (route:rest) = if route \`elem\` rest then unique rest else route : unique rest`)),
      variant('rewrite names by removing their leading spaces', routes(`
routeCandidates routes platforms = [(platform, strip route) | route <- routes, platform <- platforms, not (null route), platform > 0]
  where
    strip [] = []
    strip (' ':rest) = strip rest
    strip value = value`)),
    ],
  },
  {
    key: 'budget',
    correct: [
      variant('nested if with a decreasing remaining budget', budget(`
takeBudget budget [] = []
takeBudget budget (cost:rest) = if cost > budget then [] else cost : takeBudget (budget - cost) rest`)),
      variant('carry total spent instead of changing the initial budget', budget(`
takeBudget budget costs = buy 0 costs
  where
    buy spent [] = []
    buy spent (cost:rest)
      | spent + cost > budget = []
      | otherwise = cost : buy (spent + cost) rest`)),
    ],
    incorrect: [
      variant('skip an unaffordable snack and buy later cheaper items', budget(`
takeBudget budget [] = []
takeBudget budget (cost:rest)
  | cost <= budget = cost : takeBudget (budget - cost) rest
  | otherwise = takeBudget budget rest`)),
      variant('reuse the original budget for every price', budget(`
takeBudget budget [] = []
takeBudget budget (cost:rest)
  | cost <= budget = cost : takeBudget budget rest
  | otherwise = []`)),
      variant('stop at zero remaining budget even when free snacks follow', budget(`
takeBudget budget [] = []
takeBudget budget (cost:rest)
  | budget == 0 = []
  | cost <= budget = cost : takeBudget (budget - cost) rest
  | otherwise = []`)),
    ],
  },
];
