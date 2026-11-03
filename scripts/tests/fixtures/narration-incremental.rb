require 'jekyll'
require 'json'

# Builds the site in ARGV[0] the way `jekyll serve --incremental` does: one
# process and one Site, built again for every step, with the _data dependency
# plugin loaded. Each stdin line is a JSON step whose `files` are written
# before its build. Each stdout line reports, for every built page named in
# ARGV[1..], whether that build rewrote it and which data versions it shows.
site_dir = File.realpath(ARGV.fetch(0))
pages = ARGV.drop(1)
require_relative '../../../_plugins/data_regenerator'

Dir.chdir(site_dir)
site = Jekyll::Site.new(Jekyll.configuration(
  'source' => site_dir,
  'destination' => File.join(site_dir, '_site'),
  'incremental' => true,
  'quiet' => true
))
kept_marker = '<!-- kept from the previous build -->'
output = ->(page) { File.join(site_dir, '_site', page) }

$stdin.each_line do |line|
  step = JSON.parse(line)
  step.fetch('files', {}).each { |name, content| File.write(name, content) }
  pages.each { |page| File.write(output[page], File.read(output[page]) + kept_marker) if File.exist?(output[page]) }

  site.process
  puts JSON.generate(pages.to_h do |page|
    html = File.read(output[page])
    [page, { rewritten: !html.include?(kept_marker), shows: html[/script \S*, visuals \S*, notes \S*/] }]
  end)
end
