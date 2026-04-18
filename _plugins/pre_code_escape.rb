module PreCodeEscape
  # Escape << inside raw <pre><code> HTML blocks so Kramdown's markdownify
  # does not misinterpret <<Foo>> as an unclosed HTML tag, which breaks
  # all subsequent markdown-to-HTML conversion on the page.
  # JavaScript reads these blocks via code.textContent, which decodes
  # &lt;&lt; back to << automatically.
  def escape_chevrons_in_pre(input)
    input.gsub(/<pre[^>]*><code[^>]*>.*?<\/code><\/pre>/m) do |block|
      block.gsub('<<', '&lt;&lt;')
    end
  end
end

Liquid::Template.register_filter(PreCodeEscape)
