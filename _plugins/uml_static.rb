require 'json'
require 'open3'
require 'digest'
require 'fileutils'
require 'cgi'

module Jekyll
  class UMLStatic
    FALLBACK_CAPTIONS = {
      'class' => 'UML class diagram',
      'sequence' => 'UML sequence diagram',
      'state' => 'UML state diagram',
      'component' => 'UML component diagram',
      'deployment' => 'UML deployment diagram',
      'usecase' => 'UML use case diagram',
      'activity' => 'UML activity diagram',
      'freeform' => 'Freeform diagram',
      'gitgraph' => 'Git graph diagram',
      'folder-tree' => 'Folder tree diagram',
      'venn' => 'Venn diagram',
      'er' => 'Entity-relationship diagram',
      'crc' => 'Class-responsibility-collaborator cards',
      'c4' => 'C4 model diagram'
    }.freeze

    UML_TYPES = %w[class sequence state component deployment usecase activity].freeze
    DIAGRAM_TYPES = %w[freeform gitgraph folder-tree venn er crc c4].freeze
    DRIVER_PATH = 'js/ArchUML/uml_to_svg.js'
    RENDERER_INPUT_PATHS = [
      'js/ArchUML/uml-bundle.js',
      DRIVER_PATH,
      'js/git-graph.js',
      'js/ArchUML/css/callouts.css'
    ].freeze
    # The prerender page preloads the C4 scripts this manifest lists (paths
    # relative to the ArchUML folder), so they are renderer inputs too.
    ARCHUML_DIR = 'js/ArchUML'
    C4_MANIFEST_PATH = 'js/ArchUML/c4/manifest.json'
    C4_PRERENDERED_SCRIPT_LISTS = %w[core render].freeze

    # A malformed raw block must stop at the next pre/code boundary instead of
    # borrowing a closing tag from a later, unrelated block.
    CODE_BLOCK_PATTERN = %r{
      <pre\b[^>]*>\s*<code\b([^>]*)>
      (
        (?:(?!</?(?:pre|code)\b)[\s\S])*?
      )
      </code\s*>\s*</pre\s*>
    }mix.freeze

    SVG_ATTRIBUTE_PATTERN = /\b([A-Za-z_:][A-Za-z0-9_.:-]*)(\s*=\s*)(["'])(.*?)\3/m.freeze
    # An `<svg>` opening tag: the name, its attributes, and the closing `>` or
    # `/>` of a self-closing tag, kept apart so attributes go before the slash.
    SVG_OPENING_TAG_PATTERN = %r{(<svg\b)([^>]*?)(\s*/?>)}mi.freeze
    SVG_ROOT_OPENING_TAG_PATTERN = %r{\A(\s*<svg\b)([^>]*?)(\s*/?>)}mi.freeze
    # C4 views drawn as HTML (spec §6.6, Ruling 20): the interface card is
    # text, so it is no image; a C4 figure body is an image whose drawings are
    # presentational, like an SVG root.
    C4_CARD_ROOT_PATTERN = /\A\s*<article\b[^>]*\bclass=(["'])c4-interface\1/mi.freeze
    C4_FIGURE_BODY_ROOT_PATTERN = /\A\s*<div\b[^>]*\bclass=(["'])c4-figure-body\1/mi.freeze
    SVG_ROOT_A11Y_ATTRIBUTE_PATTERN = /\s+(?:role|aria-label|aria-labelledby|aria-describedby|aria-hidden|focusable)\s*=\s*(["'])(.*?)\1/mi.freeze
    LOCAL_FRAGMENT_ATTRIBUTES = %w[href xlink:href usemap].freeze
    LOCAL_IDREF_ATTRIBUTES = %w[
      aria-activedescendant aria-controls aria-describedby aria-details
      aria-errormessage aria-flowto aria-labelledby aria-owns
      for form headers itemref list
    ].freeze
    SVG_SYNCBASE_ATTRIBUTES = %w[begin end].freeze

    class << self
      def setup
        @cache = {}
        @node_path = find_node
        @script_path = File.join(Dir.pwd, DRIVER_PATH)
        @describe_script_path = File.join(Dir.pwd, 'js/uml-describe-cli.js')
        @cache_dir = File.join(Dir.pwd, '.uml_cache')
        @renderer_hash = renderer_fingerprint(Dir.pwd)
        FileUtils.mkdir_p(@cache_dir)
      end

      # A long-running `jekyll serve` fingerprints the renderer once per build,
      # not once per process: after an ArchUML change, cached SVGs from the old
      # renderer no longer match any diagram.
      def refresh_renderer
        setup if @cache.nil?
        fingerprint = renderer_fingerprint(Dir.pwd)
        return if fingerprint == @renderer_hash

        @renderer_hash = fingerprint
        @cache = {}
      end

      # Documents that must work without JavaScript also need their diagrams in
      # development builds (for example, printable narration steps).
      def prerender?(item)
        Jekyll.env == 'production' || ENV['JEKYLL_ENV'] == 'production' || ENV['CI'] || item.data['static_uml']
      end

      # Incremental builds regenerate a page with pre-rendered diagrams when the
      # renderer changes, not only when the page's own source does. A page that
      # did not track a renderer input yet may hold diagrams from any older
      # renderer, so it regenerates once. Jekyll treats a missing dependency as
      # changed on every build, so only existing inputs are tracked.
      def track_renderer(item)
        site = item.site
        regenerator = site.regenerator
        # The key Jekyll's regenerator looks pages and documents up by.
        source = site.in_source_dir(item.relative_path)
        dependencies = regenerator.metadata.dig(source, 'deps')
        return if dependencies.nil?

        renderer_input_paths(site.source).each do |input|
          dependency = site.in_source_dir(input)
          next if dependencies.include?(dependency) || !File.file?(dependency)

          regenerator.add_dependency(source, dependency)
          regenerator.cache[source] = true
        end
      end

      # The fixed renderer inputs, then the C4 manifest and the scripts it
      # lists for the prerender page, in load order.
      def renderer_input_paths(root_path)
        RENDERER_INPUT_PATHS + [C4_MANIFEST_PATH] + c4_prerendered_scripts(root_path)
      end

      def c4_prerendered_scripts(root_path)
        manifest_path = File.join(root_path, C4_MANIFEST_PATH)
        return [] unless File.file?(manifest_path)

        manifest = JSON.parse(File.read(manifest_path))
        C4_PRERENDERED_SCRIPT_LISTS.flat_map { |list| manifest.fetch(list) }
                                   .map { |file| File.join(ARCHUML_DIR, file) }
      end

      def renderer_fingerprint(root_path)
        digest = Digest::SHA256.new
        renderer_input_paths(root_path).each do |relative_path|
          absolute_path = File.join(root_path, relative_path)
          digest << relative_path << "\0"
          digest << (File.file?(absolute_path) ? File.binread(absolute_path) : '<missing>')
          digest << "\0"
        end
        digest.hexdigest
      end

      def find_node
        stdout, = Open3.capture2('which', 'node')
        node = stdout.strip
        node.empty? ? 'node' : node
      rescue StandardError
        'node'
      end

      def normalize_type(type)
        type.to_s.strip.downcase
      end

      def type_class(type)
        normalize_type(type).gsub(/[^a-z0-9_-]/, '-')
      end

      def fallback_caption(type)
        FALLBACK_CAPTIONS[normalize_type(type)] || 'ArchUML diagram'
      end

      def html_attr(attrs, name)
        match = attrs.to_s.match(/\b#{Regexp.escape(name)}\s*=\s*(["'])(.*?)\1/mi)
        match ? CGI.unescapeHTML(match[2]) : nil
      end

      def diagram_type_from_code_class(class_attr)
        class_attr.to_s.split(/\s+/).each do |klass|
          uml_match = klass.match(/\Alanguage-uml-([a-z0-9_-]+)\z/)
          return uml_match[1] if uml_match && UML_TYPES.include?(uml_match[1])

          diagram_match = klass.match(/\A(?:diagram|language)-([a-z0-9_-]+)\z/)
          return diagram_match[1] if diagram_match && DIAGRAM_TYPES.include?(diagram_match[1])
        end
        nil
      end

      # Pull an optional `caption: ...` line off the top of the spec or a
      # `data-uml-caption="..."` attribute off the wrapper div. Visible
      # figcaptions are reserved for author-supplied context; the structural
      # text alternative comes from the shared JS describer below.
      def extract_caption(type, text, attr_caption = nil)
        lines = text.to_s.split("\n", -1)
        spec_caption = nil

        lines.each_with_index do |line, idx|
          trimmed = line.strip
          next if trimmed.empty? || trimmed.match?(/^@startuml$/i) || trimmed.match?(/^layout\s+/i)

          match = trimmed.match(/^(?:(?:\/\/|#|'|%%)\s*)?caption\s*:\s*(.+)$/i)
          if match
            spec_caption = match[1].strip
            lines.delete_at(idx)
          end
          break
        end

        explicit = if attr_caption && !attr_caption.strip.empty?
                     attr_caption.strip
                   elsif spec_caption
                     spec_caption
                   end

        {
          text: lines.join("\n"),
          caption: explicit
        }
      end

      def collect_code_blocks(content)
        blocks = []
        content.scan(CODE_BLOCK_PATTERN) do |attrs, text|
          match = Regexp.last_match
          original = match[0]
          type = diagram_type_from_code_class(html_attr(attrs, 'class'))
          next unless type

          raw_text = CGI.unescapeHTML(text.strip)
          caption_info = extract_caption(type, raw_text)
          blocks << {
            type: type,
            text: caption_info[:text],
            caption: caption_info[:caption],
            original: original,
            position: match.begin(0)
          }
        end
        blocks
      end

      def collect_data_attribute_blocks(content)
        blocks = []
        content.scan(%r{<div\b(?=[^>]*\bdata-uml-type=)(?=[^>]*\bdata-uml-spec=)([^>]*)>[\s\S]*?</div>}mi) do |attrs|
          match = Regexp.last_match
          attrs = attrs[0] if attrs.is_a?(Array)
          original = match[0]
          type = html_attr(attrs, 'data-uml-type')
          spec = html_attr(attrs, 'data-uml-spec')
          next unless type && spec

          caption_info = extract_caption(type, spec.strip, html_attr(attrs, 'data-uml-caption'))
          blocks << {
            type: normalize_type(type),
            text: caption_info[:text],
            caption: caption_info[:caption],
            original: original,
            position: match.begin(0)
          }
        end
        blocks
      end

      # Batch-describe every diagram on the page in a single Node call. Source
      # of truth: `js/uml-auto-describe.js`, also shipped to the browser for
      # live diagrams. Returns `{ "idx" => { "brief" => String, "verbose" =>
      # Hash } }`, or an empty hash if Node/describing fails.
      def auto_describe_batch(blocks)
        return {} if blocks.empty?

        payload = {}
        blocks.each_with_index do |block, idx|
          payload[idx.to_s] = { type: block[:type], spec: block[:text] }
        end

        stdout, stderr, status = Open3.capture3(
          @node_path,
          @describe_script_path,
          stdin_data: JSON.generate(payload)
        )

        unless status.success?
          Jekyll.logger.warn 'UMLStatic:', "uml-describe-cli failed: #{stderr.strip}"
          return {}
        end

        JSON.parse(stdout)
      rescue StandardError => e
        Jekyll.logger.warn 'UMLStatic:', "uml-describe-cli error: #{e.class}: #{e.message}"
        {}
      end

      def render_verbose_description(verbose, safe_type)
        return '' unless verbose.is_a?(Hash)
        sections = verbose['sections']
        return '' unless sections.is_a?(Array) && !sections.empty?

        parts = sections.map do |section|
          heading = CGI.escapeHTML(section['heading'].to_s)
          items = (section['items'] || []).map do |item|
            "<li>#{CGI.escapeHTML(item.to_s)}</li>"
          end.join

          # Use a styled paragraph rather than a fixed heading level so this
          # inserted figure text cannot skip the surrounding page outline.
          %(<section><p class="sebook-figure__verbose-heading">#{heading}</p><ul>#{items}</ul></section>)
        end.join

        summary_text = (verbose['summary'] || '').to_s
        intro = summary_text.empty? ? '' : "<p>#{CGI.escapeHTML(summary_text)}</p>"

        <<~HTML.strip
          <div class="sebook-figure__verbose sebook-figure__verbose--#{safe_type}" data-uml-verbose="true">
            <p class="sebook-figure__verbose-title">Detailed description</p>
            <div class="sebook-figure__verbose-body">#{intro}#{parts}</div>
          </div>
        HTML
      end

      def svg_markup?(svg)
        svg.to_s.lstrip.start_with?('<svg')
      end

      def c4_card_markup?(markup)
        markup.to_s.match?(C4_CARD_ROOT_PATTERN)
      end

      # What the renderer may hand back for a figure: an SVG root, or a C4
      # HTML fragment root.
      def figure_markup?(markup)
        svg_markup?(markup) || c4_card_markup?(markup) || markup.to_s.match?(C4_FIGURE_BODY_ROOT_PATTERN)
      end

      def render_missing_blocks(blocks)
        to_render = {}
        blocks.each_with_index do |block, idx|
          hash = Digest::MD5.hexdigest(@renderer_hash + '|' + block[:type] + '|' + block[:text])
          if @cache[hash]
            block[:svg] = @cache[hash]
          elsif File.exist?(File.join(@cache_dir, "#{hash}.svg"))
            @cache[hash] = File.read(File.join(@cache_dir, "#{hash}.svg"))
            block[:svg] = @cache[hash]
          else
            to_render[idx] = { type: block[:type], text: block[:text] }
          end
        end

        return if to_render.empty?

        stdout, stderr, status = Open3.capture3(
          @node_path,
          @script_path,
          stdin_data: JSON.generate(to_render)
        )

        unless status.success?
          Jekyll.logger.error 'UMLStatic:', "Batch rendering failed: #{stderr}"
          return
        end

        JSON.parse(stdout).each do |idx_str, svg|
          idx = idx_str.to_i
          unless figure_markup?(svg)
            Jekyll.logger.warn 'UMLStatic:', "Skipping #{blocks[idx][:type]} diagram: #{svg.to_s[0, 160]}"
            next
          end

          hash = Digest::MD5.hexdigest(@renderer_hash + '|' + blocks[idx][:type] + '|' + blocks[idx][:text])
          @cache[hash] = svg
          File.write(File.join(@cache_dir, "#{hash}.svg"), svg)
          blocks[idx][:svg] = svg
        end
      rescue JSON::ParserError => e
        Jekyll.logger.error 'UMLStatic:', "Could not parse renderer output: #{e.message}"
      end

      def svg_namespace_prefix(page_identifier, occurrence_index)
        page_digest = Digest::SHA256.hexdigest(page_identifier.to_s)[0, 12]
        "uml-#{page_digest}-#{occurrence_index + 1}"
      end

      def svg_id_mapping(svg, namespace)
        attributes = svg.to_s.scan(SVG_ATTRIBUTE_PATTERN)
        ids = attributes.filter_map do |name, _equals, _quote, value|
          value if name.casecmp?('id') && !value.empty?
        end
        ids.uniq.to_h { |id| [id, "#{namespace}-#{id}"] }
      end

      def local_id_pattern(id_mapping)
        ordered_ids = id_mapping.keys.sort_by { |id| [-id.length, id] }
        Regexp.union(ordered_ids)
      end

      def rewrite_local_urls(value, id_mapping)
        id_pattern = local_id_pattern(id_mapping)
        value.gsub(/(?i:url)\(\s*(["']?)#(#{id_pattern})\1\s*\)/) do |reference|
          id = Regexp.last_match(2)
          reference.sub("##{id}", "##{id_mapping.fetch(id)}")
        end
      end

      def rewrite_fragment_reference(value, id_mapping)
        return value unless value.start_with?('#')

        id = value.delete_prefix('#')
        id_mapping.key?(id) ? "##{id_mapping.fetch(id)}" : value
      end

      def rewrite_idref_list(value, id_mapping)
        value.gsub(/\S+/) { |id| id_mapping.fetch(id, id) }
      end

      def rewrite_syncbase_references(value, id_mapping)
        id_pattern = local_id_pattern(id_mapping)
        value.gsub(/(^|[;\s])(#{id_pattern})(?=\.)/) do
          separator = Regexp.last_match(1)
          id = Regexp.last_match(2)
          "#{separator}#{id_mapping.fetch(id)}"
        end
      end

      def rewrite_svg_attribute(name, value, id_mapping)
        normalized_name = name.downcase
        return id_mapping.fetch(value, value) if normalized_name == 'id'
        return rewrite_fragment_reference(value, id_mapping) if LOCAL_FRAGMENT_ATTRIBUTES.include?(normalized_name)
        return rewrite_idref_list(value, id_mapping) if LOCAL_IDREF_ATTRIBUTES.include?(normalized_name)
        return rewrite_syncbase_references(value, id_mapping) if SVG_SYNCBASE_ATTRIBUTES.include?(normalized_name)

        value
      end

      def namespace_svg_ids(svg, namespace)
        id_mapping = svg_id_mapping(svg, namespace)
        return svg if id_mapping.empty?

        # Cache entries stay canonical. Only the copied string inserted at a
        # particular page occurrence receives a document-local namespace.
        with_local_urls = rewrite_local_urls(svg.to_s, id_mapping)
        with_local_urls.gsub(SVG_ATTRIBUTE_PATTERN) do
          name = Regexp.last_match(1)
          equals = Regexp.last_match(2)
          quote = Regexp.last_match(3)
          value = Regexp.last_match(4)
          rewritten_value = rewrite_svg_attribute(name, value, id_mapping)
          "#{name}#{equals}#{quote}#{rewritten_value}#{quote}"
        end
      end

      # Every drawing inside a figure container whose role is `img` is
      # presentational: an SVG root (drawings nested inside it are hidden with
      # it and keep their markup), or every drawing of a C4 figure body.
      def hide_nested_svg_from_accessibility(svg)
        markup = svg.to_s
        pattern = markup.match?(C4_FIGURE_BODY_ROOT_PATTERN) ? SVG_OPENING_TAG_PATTERN : SVG_ROOT_OPENING_TAG_PATTERN
        markup.gsub(pattern) do
          opening, attributes, closing = Regexp.last_match.captures
          kept = attributes.gsub(SVG_ROOT_A11Y_ATTRIBUTE_PATTERN, '')
          %(#{opening}#{kept} aria-hidden="true" focusable="false"#{closing.strip})
        end
      end

      # A C4 figure carries its source as an inert JSON string (spec §6.5).
      # Writing `<` as the JSON escape \u003c keeps `</script>` or `<!--` in
      # the text from ending the element early.
      def c4_source_element(text)
        json = JSON.generate(text).gsub('<') { '\u003c' }
        %(<script type="application/json" data-c4-source>#{json}</script>)
      end

      # A C4 figure fits its pane only at a readable size and otherwise
      # scrolls; the bundle's figure wrapper (createArchUmlFigure,
      # READABLE_FIT_TYPES in js/ArchUML/uml-bundle.js) owns that policy, and
      # a prerendered figure declares it the same way.
      def fit_policy_attribute(type)
        normalize_type(type) == 'c4' ? ' data-uml-fit="readable"' : ''
      end

      def c4_panels_attribute(text)
        panels = text.to_s[/^#[ \t]*panels[ \t]*:[ \t]*(.*?)[ \t]*$/i, 1]
        panels.nil? || panels.empty? ? '' : %( data-c4-panels="#{CGI.escapeHTML(panels)}")
      end

      def figcaption_html(block)
        return '' unless block[:caption]

        %(<figcaption class="sebook-figure__caption">#{CGI.escapeHTML(block[:caption])}</figcaption>)
      end

      # An interface card is the figure's text (spec §6.6): its container has
      # no image role, no label, and no detailed description, and it keeps
      # its source like every C4 figure.
      def wrap_c4_card(block, namespace_prefix)
        card = namespace_svg_ids(block[:svg], namespace_prefix)

        <<~HTML
          <figure class="sebook-figure sebook-figure--archuml sebook-figure--archuml-c4">
            <div class="uml-c4-diagram-container" data-uml-rendered="true" data-c4-notation="interface-card"#{c4_panels_attribute(block[:text])}>
              #{card}#{c4_source_element(block[:text])}
            </div>
            #{figcaption_html(block)}
          </figure>
        HTML
      end

      def wrap_svg(block, description_payload, namespace_prefix)
        return wrap_c4_card(block, namespace_prefix) if c4_card_markup?(block[:svg])

        safe_type = type_class(block[:type])
        brief = description_payload.is_a?(Hash) ? description_payload['brief'] : nil
        verbose = description_payload.is_a?(Hash) ? description_payload['verbose'] : nil

        desc = brief
        desc = "#{fallback_caption(block[:type])}." if desc.nil? || desc.empty?

        verbose_html = render_verbose_description(verbose, safe_type)
        namespaced_svg = namespace_svg_ids(block[:svg], namespace_prefix)
        presentational_svg = hide_nested_svg_from_accessibility(namespaced_svg)
        source_element = normalize_type(block[:type]) == 'c4' ? c4_source_element(block[:text]) : ''

        <<~HTML
          <figure class="sebook-figure sebook-figure--archuml sebook-figure--archuml-#{safe_type}">
            <div class="uml-#{safe_type}-diagram-container" data-uml-rendered="true"#{fit_policy_attribute(block[:type])} role="img" aria-label="#{CGI.escapeHTML(desc)}" tabindex="0" data-uml-scroll-tabindex="true">
              #{presentational_svg}#{source_element}
            </div>
            #{figcaption_html(block)}
            #{verbose_html}
          </figure>
        HTML
      end

      def process(content, page_identifier: 'document')
        setup if @cache.nil?

        blocks = collect_code_blocks(content) + collect_data_attribute_blocks(content)
        blocks.sort_by! { |block| block[:position] }
        return content if blocks.empty?

        render_missing_blocks(blocks)
        descriptions = auto_describe_batch(blocks)

        blocks.each_with_index do |block, idx|
          next unless block[:svg]

          namespace_prefix = svg_namespace_prefix(page_identifier, idx)
          replacement = wrap_svg(block, descriptions[idx.to_s], namespace_prefix)
          # The block form inserts the replacement literally. A string
          # replacement would treat `\&` in escaped diagram text, such as a
          # callout target's `\"`, as a backreference to the whole match.
          content.sub!(block[:original]) { replacement }
        end

        content
      end
    end
  end
end

Jekyll::Hooks.register :site, :pre_render do |site|
  Jekyll::UMLStatic.refresh_renderer
  # Jekyll decides what to regenerate after this hook.
  (site.pages + site.collections.each_value.flat_map(&:docs)).each do |item|
    Jekyll::UMLStatic.track_renderer(item) if Jekyll::UMLStatic.prerender?(item)
  end
end

Jekyll::Hooks.register [:posts, :pages, :documents], :post_render do |post|
  next unless Jekyll::UMLStatic.prerender?(post)

  # A page regenerated for its own changes starts with no dependencies.
  Jekyll::UMLStatic.track_renderer(post)

  if post.output && (post.output.include?('<html') || post.url.end_with?('/', '.html'))
    post.output = Jekyll::UMLStatic.process(post.output, page_identifier: post.url)
  end
end
