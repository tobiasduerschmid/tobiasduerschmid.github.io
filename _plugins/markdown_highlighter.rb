require 'kramdown'

Jekyll::Hooks.register [:posts, :pages, :documents], :post_render do |post|
  # Only process if it's an HTML file
  next unless post.output && post.output.include?("<html") || post.url.end_with?("/", ".html")

  # Tag-skipping regex: skips scripts, code blocks, and individual tags
  # Matches: 1. Script/Code/Pre blocks, 2. Any HTML tag, 3. The ==highlight== syntax
  post.output.gsub!(%r{<(script|code|pre|style).*?>.*?</\1>|(<[^>]+?>)|==([^=\s][^=]*?[^=\s])==}mi) do |match|
    if $1 || $2
      match # Skip tags and forbidden blocks
    else
      # It's our highlight syntax
      content = $3
      
      # Convert basic markdown inside (Italics and Bold)
      # We do this manually to be fast and avoid double-wrapping in <p> tags
      # Handling bold first, then italics
      content.gsub!(/\*\*(.+?)\*\*/, '<strong>\1</strong>')
      content.gsub!(/\*(.+?)\*/, '<em>\1</em>')
      
      "<mark>#{content}</mark>"
    end
  end
end
