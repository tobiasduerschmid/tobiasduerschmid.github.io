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

    class << self
      def setup
        @cache = {}
        @node_path = find_node
        @script_path = File.join(Dir.pwd, 'js/ArchUML/uml_to_svg.js')
        @describe_script_path = File.join(Dir.pwd, 'js/uml-describe-cli.js')
        @bundle_path = File.join(Dir.pwd, 'js/ArchUML/uml-bundle.js')
        @cache_dir = File.join(Dir.pwd, '.uml_cache')
        @renderer_hash = begin
          Digest::MD5.file(@bundle_path).hexdigest
        rescue StandardError
          'renderer-unknown'
        end
        FileUtils.mkdir_p(@cache_dir)
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
        content.scan(%r{<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)</code>\s*</pre>}mi) do |attrs, text|
          original = Regexp.last_match(0)
          type = diagram_type_from_code_class(html_attr(attrs, 'class'))
          next unless type

          raw_text = CGI.unescapeHTML(text.strip)
          caption_info = extract_caption(type, raw_text)
          blocks << {
            type: type,
            text: caption_info[:text],
            caption: caption_info[:caption],
            original: original
          }
        end
        blocks
      end

      def collect_data_attribute_blocks(content)
        blocks = []
        content.scan(%r{<div\b(?=[^>]*\bdata-uml-type=)(?=[^>]*\bdata-uml-spec=)([^>]*)>[\s\S]*?</div>}mi) do |attrs|
          original = Regexp.last_match(0)
          type = html_attr(attrs, 'data-uml-type')
          spec = html_attr(attrs, 'data-uml-spec')
          next unless type && spec

          caption_info = extract_caption(type, spec.strip, html_attr(attrs, 'data-uml-caption'))
          blocks << {
            type: normalize_type(type),
            text: caption_info[:text],
            caption: caption_info[:caption],
            original: original
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

      def wrap_svg(block, description_payload)
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

        <<~HTML
          <figure class="sebook-figure sebook-figure--archuml sebook-figure--archuml-#{safe_type}">
            <div class="uml-#{safe_type}-diagram-container" data-uml-rendered="true" role="img" aria-label="#{CGI.escapeHTML(desc)}">
              #{block[:svg]}
            </div>
            #{figcaption}
            #{verbose_html}
          </figure>
        HTML
      end

      def process(content)
        setup if @cache.nil?

        blocks = collect_code_blocks(content) + collect_data_attribute_blocks(content)
        return content if blocks.empty?

        render_missing_blocks(blocks)
        descriptions = auto_describe_batch(blocks)

        blocks.each_with_index do |block, idx|
          next unless block[:svg]

          content.gsub!(block[:original], wrap_svg(block, descriptions[idx.to_s]))
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
    post.output = Jekyll::UMLStatic.process(post.output)
  end
end
