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

    class << self
      def setup
        @cache = {}
        # Find node in PATH
        begin
          stdout, _ = Open3.capture2('which node')
          @node_path = stdout.strip
          @node_path = 'node' if @node_path.empty?
        rescue
          @node_path = 'node'
        end

        @script_path = File.join(Dir.pwd, 'js/ArchUML/uml_to_svg.js')
        @describe_script_path = File.join(Dir.pwd, 'js/uml-describe-cli.js')
        @bundle_path = File.join(Dir.pwd, 'js/ArchUML/uml-bundle.js')
        @cache_dir = File.join(Dir.pwd, '.uml_cache')
        @renderer_hash = begin
          Digest::MD5.file(@bundle_path).hexdigest
        rescue
          'renderer-unknown'
        end
        FileUtils.mkdir_p(@cache_dir)
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

      # Pull an optional `caption: …` line off the top of the spec or a
      # `data-uml-caption="…"` attribute off the wrapper div. The result is a
      # *visible figure caption* for sighted readers — supplemental context
      # the diagram itself doesn't show. Screen-reader text alternatives come
      # from `auto_describe_batch` (which delegates to the JS describer).
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

        explicit = nil
        if attr_caption && !attr_caption.strip.empty?
          explicit = attr_caption.strip
        elsif spec_caption
          explicit = spec_caption
        end

        {
          text: lines.join("\n"),
          caption: explicit
        }
      end

      # Batch-describe every diagram on the page in a single Node call. Source
      # of truth: `js/uml-auto-describe.js` (also shipped to the browser for
      # live tutorial diagrams), invoked via the `js/uml-describe-cli.js`
      # shim. Returns a Hash keyed by stringified index, where each value is
      # `{ "brief" => String, "verbose" => { "summary" => String,
      # "sections" => [{ "heading" => String, "items" => [String] }] } }`. On
      # failure (Node missing, parse error, etc.), returns an empty hash so
      # the caller can fall back to the plain type name.
      def auto_describe_batch(blocks)
        return {} if blocks.empty?

        payload = {}
        blocks.each_with_index do |block, idx|
          payload[idx.to_s] = { type: block[:type], spec: block[:text] }
        end

        stdout, stderr, status = Open3.capture3(
          "#{@node_path} #{@describe_script_path}",
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

      # Render the verbose describer output as a sighted-on-demand <details>
      # element. The same markup is also produced client-side by the browser
      # describer in `js/uml-auto-describe.js` so live tutorial diagrams pick
      # up the same drill-in. Empty / missing verbose payloads return ''.
      def render_verbose_details(verbose, safe_type)
        return '' unless verbose.is_a?(Hash)
        sections = verbose['sections']
        return '' unless sections.is_a?(Array) && !sections.empty?

        parts = sections.map do |section|
          heading = CGI.escapeHTML(section['heading'].to_s)
          items = (section['items'] || []).map do |item|
            "<li>#{CGI.escapeHTML(item.to_s)}</li>"
          end.join
          # Styled <p> rather than <h4> so the verbose drill-in doesn't
          # introduce a fixed heading level inside <figure>; on pages whose
          # outline hasn't reached <h3> (e.g. flashcards), an <h4> would
          # skip a level (WCAG 2.4.6).
          %(<section><p class="sebook-figure__verbose-heading">#{heading}</p><ul>#{items}</ul></section>)
        end.join

        summary_text = (verbose['summary'] || '').to_s
        intro = summary_text.empty? ? '' : "<p>#{CGI.escapeHTML(summary_text)}</p>"

        <<~HTML.strip
          <details class="sebook-figure__verbose sebook-figure__verbose--#{safe_type}">
            <summary>Detailed description</summary>
            <div class="sebook-figure__verbose-body">#{intro}#{parts}</div>
          </details>
        HTML
      end

      def process(content)
        setup if @cache.nil?

        # 1. Identify all UML blocks
        blocks = []

        # Match <pre><code class="language-uml-(class|sequence|state|usecase|component|deployment|activity)">...</code></pre>
        content.scan(%r{<pre><code class="language-uml-([^"]+)">([\s\S]+?)</code></pre>}) do |type, text|
          raw_text = CGI.unescapeHTML(text.strip)
          caption_info = extract_caption(type, raw_text)
          blocks << {
            type: type,
            text: caption_info[:text],
            caption: caption_info[:caption],
            original: $&
          }
        end

        # Match <div ... data-uml-type="type" data-uml-spec='spec' ...></div>
        content.scan(%r{<div[^>]*data-uml-type=(["'])(.*?)\1[^>]*data-uml-spec=(["'])([\s\S]*?)\3[^>]*>[\s\S]*?</div>}m) do |q1, type, q2, spec|
          raw_text = CGI.unescapeHTML(spec.strip)
          attr_match = $&.match(/data-uml-caption=(["'])([\s\S]*?)\1/)
          attr_caption = attr_match ? CGI.unescapeHTML(attr_match[2]) : nil
          caption_info = extract_caption(type, raw_text, attr_caption)
          blocks << {
            type: type,
            text: caption_info[:text],
            caption: caption_info[:caption],
            original: $&
          }
        end

        return content if blocks.empty?

        # 2. Filter out already cached blocks (in memory)
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

        # 3. Render missing blocks in batch
        unless to_render.empty?
          render_json = JSON.generate(to_render)
          stdout, stderr, status = Open3.capture3("#{@node_path} #{@script_path}", stdin_data: render_json)

          if status.success?
            results = JSON.parse(stdout)
            results.each do |idx_str, svg|
              idx = idx_str.to_i
              hash = Digest::MD5.hexdigest(@renderer_hash + '|' + blocks[idx][:type] + '|' + blocks[idx][:text])
              @cache[hash] = svg
              blocks[idx][:svg] = svg
            end
          else
            Jekyll.logger.error 'UMLStatic:', "Batch rendering failed: #{stderr}"
          end
        end

        # 4. Run the JS describer once for every diagram on the page. Cheaper
        # than per-block since Node startup dominates.
        descriptions = auto_describe_batch(blocks)

        # 5. Replace blocks in content. The aria-label gets the brief auto-
        # generated structural walk-through (always present, satisfies WCAG
        # 2.2 §1.1.1); the visible <figcaption> renders only when the author
        # supplied one; a collapsed <details> with the verbose breakdown
        # (every class member, every transition, etc.) is appended for
        # sighted users who want to drill in.
        blocks.each_with_index do |block, idx|
          next unless block[:svg]

          safe_type = type_class(block[:type])
          payload = descriptions[idx.to_s] || {}
          brief = payload.is_a?(Hash) ? payload['brief'] : nil
          verbose = payload.is_a?(Hash) ? payload['verbose'] : nil

          desc = brief
          desc = "#{fallback_caption(block[:type])}." if desc.nil? || desc.empty?
          aria_label = CGI.escapeHTML(desc)

          figcaption = if block[:caption]
                         %(<figcaption class="sebook-figure__caption">#{CGI.escapeHTML(block[:caption])}</figcaption>)
                       else
                         ''
                       end

          details_html = render_verbose_details(verbose, safe_type)

          svg_wrapped = <<~HTML
            <figure class="sebook-figure sebook-figure--archuml sebook-figure--archuml-#{safe_type}">
              <div class="uml-#{safe_type}-diagram-container" data-uml-rendered="true" role="img" aria-label="#{aria_label}">
                #{block[:svg]}
              </div>
              #{figcaption}
              #{details_html}
            </figure>
          HTML

          content.gsub!(block[:original], svg_wrapped)
        end

        content
      end
    end
  end
end

Jekyll::Hooks.register [:posts, :pages, :documents], :post_render do |post|
  # Only process in production environments or CI to optimize local build speed
  is_production = Jekyll.env == 'production' || ENV['JEKYLL_ENV'] == 'production' || ENV['CI']
  next unless is_production

  # Only process if it's an HTML-like output
  if post.output && (post.output.include?('<html') || post.url.end_with?('/', '.html'))
    post.output = Jekyll::UMLStatic.process(post.output)
  end
end
