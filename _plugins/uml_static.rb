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

      # Pull an optional `caption: …` line off the top of the spec or a
      # `data-uml-caption="…"` attribute off the wrapper div. The result is a
      # *visible figure caption* for sighted readers — supplemental context
      # the diagram itself doesn't show. Screen-reader text alternatives are
      # generated separately by `auto_describe`.
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

      # Build a verbal description of a diagram from its source so screen
      # readers get a structural walk-through ("class Customer with attribute
      # name; Customer is associated with Order with multiplicity 1 to many;
      # …"). The output goes into the rendered figure's aria-label so WCAG
      # 2.2 §1.1.1 (Non-text Content) is satisfied without forcing authors
      # to write a description that just retells what's already on screen.
      def auto_describe(type, spec)
        text = strip_decorations(spec.to_s)
        case normalize_type(type)
        when 'class'      then describe_class_diagram(text)
        when 'sequence'   then describe_sequence_diagram(text)
        when 'state'      then describe_state_diagram(text)
        when 'component'  then describe_component_diagram(text)
        when 'usecase'    then describe_usecase_diagram(text)
        when 'activity'   then describe_activity_diagram(text)
        when 'deployment' then describe_deployment_diagram(text)
        else
          fallback_caption(type) + '.'
        end
      rescue StandardError => e
        Jekyll.logger.warn 'UMLStatic:', "auto_describe failed (#{e.class}: #{e.message})"
        fallback_caption(type) + '.'
      end

      def strip_decorations(spec)
        text = spec.dup
        # Multi-line note blocks: `note <pos> [of X]\n…\nend note`
        text = text.gsub(/^[ \t]*note\b[^\n]*\n[\s\S]*?^[ \t]*end\s*note[ \t]*$/im, '')
        # Single-line notes: `note <pos> of X : text`
        text = text.gsub(/^[ \t]*note\b[^:\n]+:[^\n]*$/im, '')
        # Caption directives (any quoting style)
        text = text.gsub(/^[ \t]*(?:(?:\/\/|#|'|%%)\s*)?caption\s*:\s*[^\n]*$/im, '')
        # Boilerplate
        text = text.gsub(/^[ \t]*@(?:startuml|enduml)[ \t]*$/im, '')
        text = text.gsub(/^[ \t]*layout\s+[^\n]*$/im, '')
        text
      end

      # ---------- Class diagrams ----------

      CLASS_ARROWS = %w[<--> --|> ..|> <|-- <|.. *-- --* o-- --o ..> <.. --> <-- x--x x-- --x .. --].freeze

      def describe_class_diagram(spec)
        body_stripped = spec.gsub(/\{[^{}]*\}/m, '') # drop class bodies

        classes, abstracts, interfaces = [], [], []
        relationships = []
        arrow_pattern = CLASS_ARROWS.map { |a| Regexp.escape(a) }.join('|')
        rel_re = /\A(\w+)\s*(?:"([^"]*)"\s+)?(#{arrow_pattern})\s+(?:"([^"]*)"\s+)?(\w+)\s*(?::\s*(.+))?\z/

        body_stripped.each_line do |raw|
          line = raw.strip
          next if line.empty?
          if (m = line.match(/\Aabstract\s+class\s+(\w+)/))
            abstracts << m[1] unless abstracts.include?(m[1])
          elsif (m = line.match(/\Aclass\s+(\w+)/))
            classes << m[1] unless classes.include?(m[1])
          elsif (m = line.match(/\Ainterface\s+(\w+)/))
            interfaces << m[1] unless interfaces.include?(m[1])
          elsif (m = line.match(rel_re))
            relationships << {
              from: m[1], from_mult: m[2], arrow: m[3],
              to_mult: m[4], to: m[5], label: m[6]&.strip
            }
          end
        end

        return 'UML class diagram.' if classes.empty? && abstracts.empty? && interfaces.empty? && relationships.empty?

        items = []
        items << pluralize(classes.size, 'class', 'classes') + " (#{classes.join(', ')})" unless classes.empty?
        items << pluralize(abstracts.size, 'abstract class', 'abstract classes') + " (#{abstracts.join(', ')})" unless abstracts.empty?
        items << pluralize(interfaces.size, 'interface', 'interfaces') + " (#{interfaces.join(', ')})" unless interfaces.empty?
        head = items.empty? ? 'UML class diagram.' : "UML class diagram with #{items.join(', ')}."

        rel_text = relationships.map { |r| describe_class_rel(r) }.compact
        rel_text.empty? ? head : "#{head} #{rel_text.join('. ')}."
      end

      def describe_class_rel(rel)
        from, to = rel[:from], rel[:to]
        mult = format_mult(rel[:from_mult], rel[:to_mult])
        label = rel[:label] ? %( labeled "#{rel[:label]}") : ''
        case rel[:arrow]
        when '--|>'        then "#{from} extends #{to}"
        when '<|--'        then "#{to} extends #{from}"
        when '..|>'        then "#{from} implements #{to}"
        when '<|..'        then "#{to} implements #{from}"
        when '*--'         then "#{from} composes #{to}#{mult}#{label}"
        when '--*'         then "#{to} composes #{from}#{mult}#{label}"
        when 'o--'         then "#{from} aggregates #{to}#{mult}#{label}"
        when '--o'         then "#{to} aggregates #{from}#{mult}#{label}"
        when '..>'         then "#{from} depends on #{to}#{label}"
        when '<..'         then "#{to} depends on #{from}#{label}"
        when '-->'         then "#{from} references #{to}#{mult}#{label}"
        when '<--'         then "#{to} references #{from}#{mult}#{label}"
        when '<-->'        then "#{from} and #{to} reference each other#{mult}#{label}"
        when '--', '..'    then "#{from} is associated with #{to}#{mult}#{label}"
        when 'x--', '--x'  then "#{from} has a non-navigable association with #{to}#{label}"
        when 'x--x'        then "#{from} and #{to} have a non-navigable association#{label}"
        end
      end

      # ---------- Sequence diagrams ----------

      def describe_sequence_diagram(spec)
        participants = []
        messages = []
        spec.each_line do |raw|
          line = raw.strip
          next if line.empty?
          next if line.match?(/\A(activate|deactivate|create|destroy|opt|alt|else|end|loop|par|critical|break|ref|group|return)\b/i)

          if (m = line.match(/\A(participant|actor)\s+(\w+)\s*(?::\s*(.+))?\z/i))
            participants << (m[3]&.strip || m[2])
          elsif (m = line.match(/\A(\w+|o)\s*(->>|->|-->|<<-|<-|<--)\s*(\w+)\s*(?::\s*(.+))?\z/))
            messages << { from: m[1], arrow: m[2], to: m[3], text: m[4]&.strip }
          end
        end

        return 'UML sequence diagram.' if participants.empty? && messages.empty?

        head = if participants.empty?
                 'UML sequence diagram'
               else
                 "UML sequence diagram with " +
                   pluralize(participants.size, 'participant', 'participants') +
                   " (#{participants.join(', ')})"
               end

        return head + '.' if messages.empty?

        msg_text = messages.map do |m|
          verb = case m[:arrow]
                 when '-->', '<<-', '<--' then 'replies to'
                 when '->>'               then 'asynchronously messages'
                 when '<-'                then 'is called by'
                 else                          'calls'
                 end
          payload = m[:text] ? %( with "#{m[:text]}") : ''
          "#{m[:from]} #{verb} #{m[:to]}#{payload}"
        end
        "#{head}. Messages: #{msg_text.join('; ')}."
      end

      # ---------- State machine diagrams ----------

      def describe_state_diagram(spec)
        states = []
        transitions = []
        seen = {}

        record = lambda do |name|
          next if seen[name] || name == '[*]'
          seen[name] = true
          states << name
        end

        spec.each_line do |raw|
          line = raw.strip
          next if line.empty?
          if (m = line.match(/\Astate\s+(\w+)/))
            record.call(m[1])
          elsif (m = line.match(/\A(\[\*\]|\w+)\s*-->\s*(\[\*\]|\w+)\s*(?::\s*(.+))?\z/))
            transitions << { from: m[1], to: m[2], label: m[3]&.strip }
            record.call(m[1])
            record.call(m[2])
          end
        end

        return 'UML state machine diagram.' if transitions.empty? && states.empty?

        head = states.empty? ? 'UML state machine diagram' :
          "UML state machine diagram with " + pluralize(states.size, 'state', 'states') + " (#{states.join(', ')})"

        return head + '.' if transitions.empty?

        ts = transitions.map do |t|
          from = t[:from] == '[*]' ? 'the initial pseudostate' : t[:from]
          to   = t[:to]   == '[*]' ? 'the final state'        : t[:to]
          tail = t[:label] ? " on #{t[:label]}" : ''
          "#{from} transitions to #{to}#{tail}"
        end
        "#{head}. Transitions: #{ts.join('; ')}."
      end

      # ---------- Component diagrams ----------

      def describe_component_diagram(spec)
        components = []
        info = Hash.new { |h, k| h[k] = { in: [], out: [], provides: [], requires: [] } }
        port_owner = {} # alias -> component, so connections can reference owners
        connections = []
        current = nil

        spec.each_line do |raw|
          line = raw.strip
          next if line.empty?

          if (m = line.match(/\Acomponent\s+"?(\w+)"?\s*(\{?)/))
            components << m[1] unless components.include?(m[1])
            current = m[2] == '{' ? m[1] : nil
          elsif line == '}'
            current = nil
          elsif current && (m = line.match(/\A(portin|portout|provide|require)\s+"([^"]+)"\s+as\s+(\w+)/i))
            key = { 'portin' => :in, 'portout' => :out, 'provide' => :provides, 'require' => :requires }[m[1].downcase]
            info[current][key] << m[2]
            port_owner[m[3]] = current
          elsif current && (m = line.match(/\A(portin|portout|provide|require)\s+"([^"]+)"/i))
            key = { 'portin' => :in, 'portout' => :out, 'provide' => :provides, 'require' => :requires }[m[1].downcase]
            info[current][key] << m[2]
          elsif (m = line.match(/\A(\w+)\s+(-->|--|\.\.>)\s+(\w+)\s*(?::\s*(.+))?\z/))
            from = port_owner[m[1]] || m[1]
            to   = port_owner[m[3]] || m[3]
            connections << { from: from, arrow: m[2], to: to, label: m[4]&.strip }
          end
        end

        return 'UML component diagram.' if components.empty? && connections.empty?

        head = components.empty? ? 'UML component diagram' :
          "UML component diagram with " + pluralize(components.size, 'component', 'components') + " (#{components.join(', ')})"

        port_lines = info.map do |comp, h|
          parts = []
          parts << "provides #{h[:provides].join(', ')}" unless h[:provides].empty?
          parts << "requires #{h[:requires].join(', ')}" unless h[:requires].empty?
          parts << "incoming ports #{h[:in].join(', ')}" unless h[:in].empty?
          parts << "outgoing ports #{h[:out].join(', ')}" unless h[:out].empty?
          parts.empty? ? nil : "#{comp} #{parts.join(', ')}"
        end.compact

        conn_lines = connections.map do |c|
          verb = case c[:arrow]
                 when '..>' then 'depends on'
                 when '-->' then 'connects to'
                 else            'is associated with'
                 end
          label = c[:label] ? %( labeled "#{c[:label]}") : ''
          "#{c[:from]} #{verb} #{c[:to]}#{label}"
        end

        out = head + '.'
        out += ' ' + port_lines.join('. ') + '.' unless port_lines.empty?
        out += ' Connections: ' + conn_lines.join('; ') + '.' unless conn_lines.empty?
        out
      end

      # ---------- Use case diagrams ----------

      def describe_usecase_diagram(spec)
        actors = []
        usecases = []
        usecase_alias = {}
        relationships = []

        spec.each_line do |raw|
          line = raw.strip
          next if line.empty?

          if (m = line.match(/\Aactor\s+"?([^"\n]+?)"?\s*(?:as\s+(\w+))?\z/i))
            actors << m[1].strip unless actors.include?(m[1].strip)
          elsif (m = line.match(/\Ausecase\s+"([^"]+)"\s*as\s+(\w+)/i))
            usecases << m[1] unless usecases.include?(m[1])
            usecase_alias[m[2]] = m[1]
          elsif (m = line.match(/\A(\w+)\s+(--|\.\.>|--\|>)\s+(\w+)\s*(?::\s*(.+))?\z/))
            relationships << { from: m[1], arrow: m[2], to: m[3], label: m[4]&.strip }
          end
        end

        return 'UML use case diagram.' if actors.empty? && usecases.empty?

        items = []
        items << pluralize(actors.size, 'actor', 'actors') + " (#{actors.join(', ')})" unless actors.empty?
        items << pluralize(usecases.size, 'use case', 'use cases') + " (#{usecases.join(', ')})" unless usecases.empty?
        head = "UML use case diagram with #{items.join(' and ')}"

        rel_lines = relationships.map do |r|
          name = ->(id) { usecase_alias[id] ? %("#{usecase_alias[id]}") : id }
          if r[:label] =~ /<<\s*include\s*>>/i
            "#{name.call(r[:from])} includes #{name.call(r[:to])}"
          elsif r[:label] =~ /<<\s*extend\s*>>/i
            "#{name.call(r[:from])} extends #{name.call(r[:to])}"
          elsif r[:arrow] == '--|>'
            "#{name.call(r[:from])} specializes #{name.call(r[:to])}"
          else
            "#{name.call(r[:from])} associates with #{name.call(r[:to])}"
          end
        end

        rel_lines.empty? ? head + '.' : "#{head}. #{rel_lines.join('. ')}."
      end

      # ---------- Activity / deployment (lightweight) ----------

      def describe_activity_diagram(spec)
        nodes = spec.scan(/^\s*:([^;|\n]+);/).flatten.map(&:strip).uniq
        return 'UML activity diagram.' if nodes.empty?
        "UML activity diagram with " + pluralize(nodes.size, 'activity', 'activities') + " (#{nodes.join(', ')})."
      end

      def describe_deployment_diagram(spec)
        nodes = spec.scan(/^\s*node\s+"?([^"\n{]+?)"?\s*(?:\{|$)/i).flatten.map(&:strip).uniq
        artifacts = spec.scan(/^\s*artifact\s+"?([^"\n]+?)"?\s*$/i).flatten.map(&:strip).uniq
        return 'UML deployment diagram.' if nodes.empty? && artifacts.empty?
        items = []
        items << pluralize(nodes.size, 'node', 'nodes') + " (#{nodes.join(', ')})" unless nodes.empty?
        items << pluralize(artifacts.size, 'artifact', 'artifacts') + " (#{artifacts.join(', ')})" unless artifacts.empty?
        "UML deployment diagram with #{items.join(' and ')}."
      end

      # ---------- helpers ----------

      def pluralize(n, singular, plural)
        n == 1 ? "1 #{singular}" : "#{n} #{plural}"
      end

      def format_mult_value(m)
        return 'one' if m.nil?
        case m
        when '*', '0..*' then 'many'
        when '1..*'      then 'one or more'
        when '0..1'      then 'zero or one'
        when '1'         then 'one'
        else                  m
        end
      end

      def format_mult(from_mult, to_mult)
        return '' unless from_mult || to_mult
        " with multiplicity #{format_mult_value(from_mult)} to #{format_mult_value(to_mult)}"
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
            description: auto_describe(type, caption_info[:text]),
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
            description: auto_describe(type, caption_info[:text]),
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

        # 4. Replace blocks in content. The aria-label gets the auto-generated
        # structural walk-through (always present, satisfies WCAG 2.2 §1.1.1);
        # the visible <figcaption> is rendered only when the author supplied
        # one (no more "UML class diagram" italic fallbacks cluttering pages).
        blocks.each do |block|
          next unless block[:svg]

          safe_type = type_class(block[:type])
          aria_label = CGI.escapeHTML(block[:description] || fallback_caption(block[:type]))

          figcaption = if block[:caption]
                         %(<figcaption class="sebook-figure__caption">#{CGI.escapeHTML(block[:caption])}</figcaption>)
                       else
                         ''
                       end

          svg_wrapped = <<~HTML
            <figure class="sebook-figure sebook-figure--archuml sebook-figure--archuml-#{safe_type}">
              <div class="uml-#{safe_type}-diagram-container" data-uml-rendered="true" role="img" aria-label="#{aria_label}">
                #{block[:svg]}
              </div>
              #{figcaption}
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
