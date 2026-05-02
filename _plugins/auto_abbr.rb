require 'cgi'

module Jekyll
  module AutoAbbr
    TARGET_LAYOUTS = %w[
      sebook
      sebook-combined
      tutorial
      print-tutorial
      blog-post
    ].freeze

    SKIP_TAGS = %w[
      a
      abbr
      button
      code
      h1
      h2
      h3
      h4
      h5
      h6
      kbd
      option
      pre
      samp
      script
      select
      style
      svg
      textarea
    ].freeze

    VOID_TAGS = %w[
      area
      base
      br
      col
      embed
      hr
      img
      input
      link
      meta
      param
      source
      track
      wbr
    ].freeze

    TOKEN_RE = /(<[^>]+>)/m
    MAIN_RE = %r{(<main\b(?=[^>]*\bid=(['"])main-content\2)[^>]*>)(.*?)(</main>)}mi

    class << self
      def target_layout?(doc)
        TARGET_LAYOUTS.include?(doc.data['layout'].to_s)
      end

      def glossary_dependency_path(source)
        File.join(source, '_data', 'glossary.yml')
      end

      def glossary_entries(site)
        Array(site.data['glossary']).filter_map do |entry|
          term = entry['term'].to_s
          definition = entry['definition'].to_s
          next if term.empty? || definition.empty?

          { term: term, definition: definition }
        end
      end

      def process_output(output, entries)
        matcher, forms = build_matcher(entries)
        return output unless matcher

        output.gsub(MAIN_RE) do
          opening = Regexp.last_match(1)
          body = Regexp.last_match(3)
          closing = Regexp.last_match(4)
          "#{opening}#{process_fragment(body, matcher, forms)}#{closing}"
        end
      end

      def process_fragment(fragment, matcher, forms)
        skip_stack = []

        fragment.split(TOKEN_RE).map do |token|
          if token.start_with?('<')
            handle_tag(token, skip_stack)
            token
          elsif skip_stack.empty?
            replace_text(token, matcher, forms)
          else
            token
          end
        end.join
      end

      def replace_text(text, matcher, forms)
        text.gsub(matcher) do
          prefix = Regexp.last_match(1)
          word = Regexp.last_match(2)
          entry = forms[word]
          next "#{prefix}#{word}" unless entry

          title = CGI.escapeHTML(entry[:definition])
          "#{prefix}<abbr title=\"#{title}\" data-no-tooltip=\"true\">#{word}</abbr>"
        end
      end

      def build_matcher(entries)
        forms = {}
        entries.each do |entry|
          term = entry[:term]
          forms[term] ||= entry
          plural = plural_form(term)
          forms[plural] ||= entry if plural
        end

        alternatives = forms.keys
          .sort_by { |form| [-form.length, form] }
          .map { |form| Regexp.escape(form) }

        return [nil, forms] if alternatives.empty?

        [/(^|[^A-Za-z0-9_])(#{alternatives.join('|')})(?=$|[^A-Za-z0-9_])/, forms]
      end

      def plural_form(term)
        return nil if term.match?(/s\z/i)

        "#{term}s"
      end

      def handle_tag(tag, skip_stack)
        if (closing = closing_tag_name(tag))
          skip_stack.pop if skip_stack.last == closing
          return
        end

        name = opening_tag_name(tag)
        return unless name
        return if void_tag?(name, tag)

        if skip_stack.any?
          skip_stack << name
        elsif starts_skip_region?(name, tag)
          skip_stack << name
        end
      end

      def starts_skip_region?(name, tag)
        SKIP_TAGS.include?(name) ||
          tag.match?(/\bid\s*=\s*(['"])references\1/i) ||
          tag.match?(/\bclass\s*=\s*(['"])[^'"]*\bbibliography\b/i)
      end

      def opening_tag_name(tag)
        return nil if tag.start_with?('</', '<!', '<?')

        tag[/\A<\s*([A-Za-z][\w:-]*)/i, 1]&.downcase
      end

      def closing_tag_name(tag)
        tag[/\A<\s*\/\s*([A-Za-z][\w:-]*)/i, 1]&.downcase
      end

      def void_tag?(name, tag)
        VOID_TAGS.include?(name) || tag.match?(%r{/\s*>$})
      end
    end
  end
end

module AutoAbbrFilter
  def auto_abbr(input)
    site = @context.registers[:site]
    entries = Jekyll::AutoAbbr.glossary_entries(site)
    matcher, forms = Jekyll::AutoAbbr.build_matcher(entries)
    return input.to_s unless matcher

    Jekyll::AutoAbbr.process_fragment(input.to_s, matcher, forms)
  end
end

Liquid::Template.register_filter(AutoAbbrFilter)

Jekyll::Hooks.register [:pages, :posts, :documents], :post_render do |doc|
  next unless Jekyll::AutoAbbr.target_layout?(doc)
  next unless doc.output&.include?('<main')

  entries = Jekyll::AutoAbbr.glossary_entries(doc.site)
  doc.output = Jekyll::AutoAbbr.process_output(doc.output, entries)
end
