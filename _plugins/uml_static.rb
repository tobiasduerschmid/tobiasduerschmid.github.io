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
      'er' => 'Entity-relationship diagram'
    }.freeze

    UML_TYPES = %w[class sequence state component deployment usecase activity].freeze
    DIAGRAM_TYPES = %w[freeform gitgraph folder-tree venn er].freeze
    RENDERER_INPUT_PATHS = %w[
      js/ArchUML/uml-bundle.js
      js/ArchUML/uml_to_svg.js
      js/git-graph.js
    ].freeze

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
    SVG_ROOT_PATTERN = /\A(\s*<svg\b)([^>]*)>/mi.freeze
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
        @script_path = File.join(Dir.pwd, RENDERER_INPUT_PATHS[1])
        @describe_script_path = File.join(Dir.pwd, 'js/uml-describe-cli.js')
        @cache_dir = File.join(Dir.pwd, '.uml_cache')
        @renderer_hash = renderer_fingerprint(Dir.pwd)
        FileUtils.mkdir_p(@cache_dir)
      end

      def renderer_fingerprint(root_path)
        digest = Digest::SHA256.new
        RENDERER_INPUT_PATHS.each do |relative_path|
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
          unless svg_markup?(svg)
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

      def hide_nested_svg_from_accessibility(svg)
        svg.to_s.sub(SVG_ROOT_PATTERN) do
          opening = Regexp.last_match(1)
          attributes = Regexp.last_match(2).gsub(SVG_ROOT_A11Y_ATTRIBUTE_PATTERN, '')
          %(#{opening}#{attributes} aria-hidden="true" focusable="false">)
        end
      end

      def wrap_svg(block, description_payload, namespace_prefix)
        safe_type = type_class(block[:type])
        brief = description_payload.is_a?(Hash) ? description_payload['brief'] : nil
        verbose = description_payload.is_a?(Hash) ? description_payload['verbose'] : nil

        desc = brief
        desc = "#{fallback_caption(block[:type])}." if desc.nil? || desc.empty?

        figcaption = if block[:caption]
                       %(<figcaption class="sebook-figure__caption">#{CGI.escapeHTML(block[:caption])}</figcaption>)
                     else
                       ''
                     end

        verbose_html = render_verbose_description(verbose, safe_type)
        namespaced_svg = namespace_svg_ids(block[:svg], namespace_prefix)
        presentational_svg = hide_nested_svg_from_accessibility(namespaced_svg)

        <<~HTML
          <figure class="sebook-figure sebook-figure--archuml sebook-figure--archuml-#{safe_type}">
            <div class="uml-#{safe_type}-diagram-container" data-uml-rendered="true" role="img" aria-label="#{CGI.escapeHTML(desc)}">
              #{presentational_svg}
            </div>
            #{figcaption}
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
          content.sub!(block[:original], replacement)
        end

        content
      end
    end
  end
end

Jekyll::Hooks.register [:posts, :pages, :documents], :post_render do |post|
  is_production = Jekyll.env == 'production' || ENV['JEKYLL_ENV'] == 'production' || ENV['CI']
  next unless is_production

  if post.output && (post.output.include?('<html') || post.url.end_with?('/', '.html'))
    post.output = Jekyll::UMLStatic.process(post.output, page_identifier: post.url)
  end
end
