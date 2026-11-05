require 'json'

# Draws a song's ArchUML views at build time. A storyboard's `diagrams`
# (name => { kind, spec }) go through the headless renderer and .uml_cache
# that draw the SEBook's static diagrams (uml_static.rb). The song player
# layout embeds the SVGs as JSON, and js/song-video/model-kit.js uses them
# instead of routing every connector while the player loads; that routing
# took over a second for the design patterns song.
#
# Unlike page diagrams, these are drawn in development builds too: a song has
# a handful, cached after the first build, and a local player should start as
# fast as the deployed one. A view the renderer fails on is left out, and the
# player draws it in the browser.
module Jekyll
  module SongDiagramsFilter
    # JSON for a <script type="application/json">: [{ kind, spec, svg }].
    def song_diagram_svgs(diagrams)
      views = diagrams.is_a?(Hash) ? diagrams.values : []
      blocks = views.map { |view| { type: view['kind'].to_s, text: view['spec'].to_s } }
      unless blocks.empty?
        UMLStatic.refresh_renderer
        UMLStatic.render_missing_blocks(blocks)
      end
      drawn = blocks.select { |block| block[:svg] }.map { |block| { kind: block[:type], spec: block[:text], svg: block[:svg] } }
      # `<` escaped, so no SVG text can close the script element.
      JSON.generate(drawn).gsub('<', '\\u003c')
    end
  end
end

Liquid::Template.register_filter(Jekyll::SongDiagramsFilter)
