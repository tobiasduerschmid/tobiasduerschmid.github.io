Jekyll::Hooks.register [:posts, :documents], :pre_render do |post|
  # Only process markdown files to avoid touching assets or layouts
  if post.path.end_with?(".md", ".markdown")
    # Replace ==text== with <mark>text</mark>
    # Using a robust regex that handles punctuation and curly quotes
    post.content.gsub!(/(?<![=])==([^=\s][^=]*?[^=\s])==(?![=])/, '<mark>\1</mark>')
  end
end
