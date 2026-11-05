require 'json'
require 'open3'
require 'digest'
require 'fileutils'

module NarrationSnapshots
  # Reuse each live artwork renderer at its settled, reduced-motion state.
  # Cache by all rendering inputs; a failed snapshot must fail the build rather
  # than publish a lesson whose diagrams contradict the accompanying text.
  def narration_snapshots(html, topic)
    site = @context.registers[:site]
    story = site.data.fetch('explainers').fetch(topic)
    renderer = site.data.fetch('narration_views').fetch(topic).fetch('renderer')
    payload = JSON.generate(html: html, scenes: story.fetch('scenes'), renderer: renderer)
    driver = File.join(site.source, 'scripts/render-narration-snapshots.js')
    artwork = File.join(site.source, "js/#{topic}-animation-art.js")
    key = Digest::SHA256.hexdigest(payload + File.read(driver) + File.read(artwork))
    cache = File.join(site.source, '.cache/narration-reading', "#{key}.html")
    return File.read(cache) if File.file?(cache)

    output, error, status = Open3.capture3('node', driver, artwork, stdin_data: payload)
    raise Jekyll::Errors::FatalException, "#{topic} reading snapshots failed: #{error}" unless status.success?

    FileUtils.mkdir_p(File.dirname(cache))
    File.write(cache, output)
    output
  end
end

Liquid::Template.register_filter(NarrationSnapshots)
