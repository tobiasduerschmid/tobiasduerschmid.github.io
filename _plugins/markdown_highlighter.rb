require 'kramdown'
require 'json'

module MarkdownHighlighter
  SKIP_OR_HIGHLIGHT = %r{<(script|code|pre|style)\b.*?>.*?</\1>|(<[^>]+?>)|==(\S(?:.*?\S)?)==}mi.freeze
  DESCRIPTION_META = /\b(?:name|property)=["'](?:description|og:description|twitter:description)["']/i.freeze
  JSON_LD_SCRIPT = %r{(<script\b[^>]*\btype=["']application/ld\+json["'][^>]*>)(.*?)(</script>)}mi.freeze

  def self.render_inline_markdown(content)
    html = Kramdown::Document.new(content, input: 'GFM').to_html.strip
    html.sub(/\A<p>/, '').sub(%r{</p>\z}, '')
  end

  def self.strip_highlight_delimiters(content)
    content.gsub(/==(\S(?:.*?\S)?)==/m, '\1')
  end

  def self.strip_description_meta_delimiters(output)
    output.gsub(/<meta\b[^>]*>/i) do |tag|
      next tag unless tag.match?(DESCRIPTION_META)

      tag.gsub(/(\bcontent=)(["'])(.*?)\2/mi) do
        "#{Regexp.last_match(1)}#{Regexp.last_match(2)}#{strip_highlight_delimiters(Regexp.last_match(3))}#{Regexp.last_match(2)}"
      end
    end
  end

  def self.clean_json_ld_descriptions(value)
    case value
    when Hash
      value.transform_values do |child|
        clean_json_ld_descriptions(child)
      end.tap do |hash|
        hash['description'] = strip_highlight_delimiters(hash['description']) if hash['description'].is_a?(String)
      end
    when Array
      value.map { |child| clean_json_ld_descriptions(child) }
    else
      value
    end
  end

  def self.strip_json_ld_description_delimiters(output)
    output.gsub(JSON_LD_SCRIPT) do |script|
      json = Regexp.last_match(2)
      parsed = JSON.parse(json)
      "#{Regexp.last_match(1)}#{JSON.generate(clean_json_ld_descriptions(parsed))}#{Regexp.last_match(3)}"
    rescue JSON::ParserError
      script
    end
  end

  def self.process(output)
    output = strip_description_meta_delimiters(output)
    output = strip_json_ld_description_delimiters(output)

    output.gsub(SKIP_OR_HIGHLIGHT) do |match|
      skipped_block = Regexp.last_match(1)
      html_tag = Regexp.last_match(2)
      content = Regexp.last_match(3)

      if skipped_block || html_tag
        match
      else
        "<mark>#{render_inline_markdown(content)}</mark>"
      end
    end
  end
end

Jekyll::Hooks.register [:posts, :pages, :documents], :post_render do |post|
  # Only process if it's an HTML file
  next unless post.output && (post.output.include?("<html") || post.url.end_with?("/", ".html"))

  post.output = MarkdownHighlighter.process(post.output)
end
