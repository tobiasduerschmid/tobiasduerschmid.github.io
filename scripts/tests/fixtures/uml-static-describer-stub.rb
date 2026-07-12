require 'json'

descriptions = JSON.parse($stdin.read).to_h { |index, _diagram| [index, {}] }
$stdout.write(JSON.generate(descriptions))
