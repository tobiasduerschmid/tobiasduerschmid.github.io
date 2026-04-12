require 'json'
require 'open3'
require 'digest'
require 'fileutils'
require 'cgi'

module Jekyll
  class UMLStatic
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
        
        @script_path = File.join(Dir.pwd, 'scripts/uml_to_svg.js')
        @cache_dir = File.join(Dir.pwd, '.uml_cache')
        FileUtils.mkdir_p(@cache_dir)
      end

      def process(content)
        setup if @cache.nil?
        
        # 1. Identify all UML blocks
        blocks = []
        
        # Match <pre><code class="language-uml-(class|sequence|state|usecase|component|deployment|activity)">...</code></pre>
        content.scan(%r{<pre><code class="language-uml-([^"]+)">([\s\S]+?)</code></pre>}) do |type, text|
          raw_text = CGI.unescapeHTML(text.strip)
          blocks << { type: type, text: raw_text, original: $& }
        end

        # Match <div ... data-uml-type="type" data-uml-spec='spec' ...></div>
        # Using a more flexible regex for attributes
        content.scan(%r{<div[^>]*data-uml-type=["']([^"']+)["'][^>]*data-uml-spec=["']([^"']+)["'][^>]*>[\s\S]*?</div>}m) do |type, spec|
          raw_text = CGI.unescapeHTML(spec.strip)
          blocks << { type: type, text: raw_text, original: $& }
        end

        return content if blocks.empty?

        # 2. Filter out already cached blocks (in memory)
        to_render = {}
        blocks.each_with_index do |block, idx|
          hash = Digest::MD5.hexdigest(block[:type] + block[:text])
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
              hash = Digest::MD5.hexdigest(blocks[idx][:type] + blocks[idx][:text])
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
          
          # Wrap in a container to maintain styling and allow dark-mode filter
          svg_wrapped = <<~HTML
            <div class="uml-#{block[:type]}-diagram-container" data-uml-rendered="true">
              #{block[:svg]}
            </div>
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
