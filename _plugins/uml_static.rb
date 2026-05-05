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
          stdout, _ = Open3.capture2("which node")
          @node_path = stdout.strip
          @node_path = "node" if @node_path.empty?
        rescue
          @node_path = "node"
        end
        
        @script_path = File.join(Dir.pwd, 'js/ArchUML/uml_to_svg.js')
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

      def extract_caption(type, text, attr_caption = nil)
        lines = text.to_s.split("\n", -1)
        caption = nil
        explicit = false

        lines.each_with_index do |line, idx|
          trimmed = line.strip
          next if trimmed.empty? || trimmed.match?(/^@startuml$/i) || trimmed.match?(/^layout\s+/i)

          match = trimmed.match(/^(?:(?:\/\/|#|'|%%)\s*)?caption\s*:\s*(.+)$/i)
          if match
            caption = match[1].strip
            lines.delete_at(idx)
            explicit = true
          end
          break
        end

        # `data-uml-caption` attribute on the wrapper div takes precedence over a
        # `caption:` line inside the spec. Authors can keep the spec free of
        # caption clutter and instead set the caption next to the diagram type.
        if attr_caption && !attr_caption.strip.empty?
          caption = attr_caption.strip
          explicit = true
        end

        {
          text: lines.join("\n"),
          caption: caption || fallback_caption(type),
          explicit: explicit
        }
      end

      def process(content)
        setup if @cache.nil?
        
        # 1. Identify all UML blocks
        blocks = []
        
        # Match <pre><code class="language-uml-(class|sequence|state|usecase|component|deployment|activity)">...</code></pre>
        content.scan(%r{<pre><code class="language-uml-([^"]+)">([\s\S]+?)</code></pre>}) do |type, text|
          raw_text = CGI.unescapeHTML(text.strip)
          caption_info = extract_caption(type, raw_text)
          blocks << { type: type, text: caption_info[:text], caption: caption_info[:caption], explicit_caption: caption_info[:explicit], original: $& }
        end

        # Match <div ... data-uml-type="type" data-uml-spec='spec' ...></div>
        # Using a more flexible regex for attributes
        content.scan(%r{<div[^>]*data-uml-type=(["'])(.*?)\1[^>]*data-uml-spec=(["'])([\s\S]*?)\3[^>]*>[\s\S]*?</div>}m) do |q1, type, q2, spec|
          raw_text = CGI.unescapeHTML(spec.strip)
          # Pull an optional `data-uml-caption="..."` attribute off the wrapper
          # div so authors can set the figure caption alongside the diagram type
          # rather than inside the spec body.
          attr_match = $&.match(/data-uml-caption=(["'])([\s\S]*?)\1/)
          attr_caption = attr_match ? CGI.unescapeHTML(attr_match[2]) : nil
          caption_info = extract_caption(type, raw_text, attr_caption)
          blocks << { type: type, text: caption_info[:text], caption: caption_info[:caption], explicit_caption: caption_info[:explicit], original: $& }
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
            Jekyll.logger.error "UMLStatic:", "Batch rendering failed: #{stderr}"
          end
        end

        # 4. Replace blocks in content
        blocks.each do |block|
          next unless block[:svg]
          
          # Wrap in a figure so static-rendered diagrams match the client path.
          safe_type = type_class(block[:type])
          escaped_caption = CGI.escapeHTML(block[:caption])
          caption_class = 'sebook-figure__caption'
          caption_class += ' sebook-figure__caption--auto' unless block[:explicit_caption]
          svg_wrapped = <<~HTML
            <figure class="sebook-figure sebook-figure--archuml sebook-figure--archuml-#{safe_type}">
              <div class="uml-#{safe_type}-diagram-container" data-uml-rendered="true" role="img" aria-label="#{escaped_caption}">
                #{block[:svg]}
              </div>
              <figcaption class="#{caption_class}">#{escaped_caption}</figcaption>
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
  is_production = Jekyll.env == "production" || ENV['JEKYLL_ENV'] == "production" || ENV['CI']
  next unless is_production

  # Only process if it's an HTML-like output
  if post.output && (post.output.include?("<html") || post.url.end_with?("/", ".html"))
    post.output = Jekyll::UMLStatic.process(post.output)
  end
end
