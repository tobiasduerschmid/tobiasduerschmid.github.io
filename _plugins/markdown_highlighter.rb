require 'kramdown'

module MarkdownHighlighter
  SKIP_OR_HIGHLIGHT = %r{<(script|code|pre|style)\b.*?>.*?</\1>|(<[^>]+?>)|==(\S(?:.*?\S)?)==}mi.freeze

  def self.render_inline_markdown(content)
    html = Kramdown::Document.new(content, input: 'GFM').to_html.strip
    html.sub(/\A<p>/, '').sub(%r{</p>\z}, '')
  end

  def self.process(output)
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
