require 'jekyll'
require 'json'

# Builds the site in ARGV[0] the way `jekyll serve --incremental` does: one
# process and one Site, built again for every step. ARGV[1] is `plugin` to load
# the static UML plugin, or `plain` to build without it. Each stdin line is a
# JSON step whose `files` are written before its build; each stdout line
# reports the built index page.
site_dir = File.realpath(ARGV.fetch(0))
require_relative '../../../_plugins/uml_static' if ARGV.fetch(1) == 'plugin'

Dir.chdir(site_dir)
site = Jekyll::Site.new(Jekyll.configuration(
  'source' => site_dir,
  'destination' => File.join(site_dir, '_site'),
  'incremental' => true,
  'quiet' => true
))
output = File.join(site_dir, '_site', 'index.html')
kept_marker = '<!-- kept from the previous build -->'

$stdin.each_line do |line|
  step = JSON.parse(line)
  step.fetch('files', {}).each { |name, content| File.write(name, content) }
  File.write(output, File.read(output) + kept_marker) if File.exist?(output)

  site.process
  html = File.read(output)
  puts JSON.generate(
    rewritten: !html.include?(kept_marker),
    diagram: html[/drawn by renderer v\d+/],
    text: html[/Page version \d+/]
  )
end
