require 'jekyll'
require 'json'
require 'tmpdir'

# Renders the shared tutorial print content for one tutorial, read as JSON on
# stdin, with the repository's real includes, filters, and plugins. Tests can
# pin the print view's HTML without building the whole site.
Encoding.default_external = Encoding::UTF_8
root = File.expand_path('../../..', __dir__)
tutorial = JSON.parse($stdin.read)

Dir.mktmpdir('tutorial-print-harness') do |destination|
  site = Jekyll::Site.new(Jekyll.configuration(
    'source' => root,
    'destination' => destination,
    'quiet' => true
  ))
  site.data['tutorials'] = { 'fixture' => tutorial }
  template = site.liquid_renderer.file('(tutorial print harness)').parse(
    "{% include tutorial-print-content.html tutorial='fixture' show_header=false %}"
  )
  print template.render!(site.site_payload, registers: { site: site, page: {} })
end
