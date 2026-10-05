/** Lazy observation support compiled by MicroHs alongside the learner's module.
 * Observers record demand; they never evaluate a field just to display it.
 * Keep the private GETRAW handshake out of ordinary program stdin.
 */
(function (scope) {
  'use strict';
  function source(marker) {
    return String.raw`module SEBookDebug (module SEBookDebug, ($)) where
import System.IO.Unsafe (unsafePerformIO)
import System.IO (hPutStrLn, hFlush, stdout, stderr)
import Data.IORef
import Data.Char (ord)
foreign import ccall "GETRAW" getDebugCommand :: IO Int
noMatch :: String -> a
noMatch name = error ("No matching equation for " ++ name)
counter :: IORef Int
counter = unsafePerformIO (newIORef 0)
emit event site context payload = do
  hPutStrLn stderr (${JSON.stringify(marker)} ++ event ++ ":" ++ show site ++ ":" ++ show context ++ ":" ++ show (map ord payload))
  hFlush stderr
pause event site context payload = do
  hFlush stdout
  emit event site context payload
  _ <- getDebugCommand
  return ()
call :: Int -> (Int -> String -> a -> a) -> (Int -> a) -> a
call site observer body = unsafePerformIO (do
  context <- readIORef counter
  writeIORef counter (context + 1)
  pause "call" site context ""
  let value = observer context "result" (body context)
  seq value (pause "return" site context "")
  return value)
-- The wrapper runs only when the original application is demanded. The closing
-- marker also clears metadata if sharing means there is no new call event.
application :: Int -> Int -> a -> a
application site context value = unsafePerformIO (do
  emit "application" site context ""
  seq value (emit "applied" site context "")
  return value)
-- Observing a local RHS preserves its sharing and runs only on demand.
binding :: Int -> Int -> String -> (Int -> String -> a -> a) -> a -> a
binding site context path observer original = unsafePerformIO (do
  pause "binding" site context ""
  let value = observer context path original
  seq value (pause "bound" site context "")
  return value)
step :: String -> Int -> Int -> a -> a
step event site context value = unsafePerformIO (do
  pause event site context ""
  return value)
matched :: Int -> Int -> Bool
matched site context = step "match" site context False
condition :: Int -> Int -> Bool -> Bool
condition site context value = unsafePerformIO (do
  pause "test" site context ""
  if value then pause "true" site context "" else pause "false" site context ""
  return value)
record :: Int -> String -> String -> String -> IO ()
record context path kind value = emit "value" 0 context (path ++ "\t" ++ kind ++ "\t" ++ value)
-- Path length bounds observation of productive infinite structures. Returning
-- the original value beyond that limit preserves its demand and sharing.
opaque :: Int -> String -> a -> a
opaque context path value = unsafePerformIO (do
  seq value (record context path "opaque" "")
  return value)
scalar :: (a -> String) -> Int -> String -> a -> a
scalar display context path value = unsafePerformIO (do
  seq value (record context path "scalar" (display value))
  return value)
int :: Int -> String -> Int -> Int
int = scalar show
word :: Int -> String -> Word -> Word
word = scalar show
bool :: Int -> String -> Bool -> Bool
bool = scalar show
char :: Int -> String -> Char -> Char
char = scalar show
float :: Int -> String -> Float -> Float
float = scalar show
double :: Int -> String -> Double -> Double
double = scalar show
list :: (Int -> String -> a -> a) -> Int -> String -> [a] -> [a]
list item context path value
  | length path > 80 = value
  | otherwise = unsafePerformIO (case value of
      [] -> do
        record context path "nil" ""
        return []
      x:xs -> do
        record context path "cons" ""
        return (item context (path ++ ".h") x : list item context (path ++ ".t") xs))
pair :: (Int -> String -> a -> a) -> (Int -> String -> b -> b) -> Int -> String -> (a,b) -> (a,b)
pair left right context path value = unsafePerformIO (case value of
  (a,b) -> do
    record context path "pair" ""
    return (left context (path ++ ".0") a, right context (path ++ ".1") b))
optional :: (Int -> String -> a -> a) -> Int -> String -> Maybe a -> Maybe a
optional item context path value = unsafePerformIO (case value of
  Nothing -> do
    record context path "scalar" "Nothing"
    return Nothing
  Just a -> do
    record context path "just" ""
    return (Just (item context (path ++ ".0") a)))
`;
  }
  const api = { source };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.SEBookHaskellHelper = api;
})(globalThis);
