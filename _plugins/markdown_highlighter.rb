Jekyll::Hooks.register [:posts, :pages, :documents], :post_render do |post|
  # We use a regex that matches the markers and their content
  # but we perform the replacement only if the markers are in "plain text" areas
  # of the HTML (not inside tags like <script>, <code>, <pre>, or as attributes).
  
  # This pattern matches any tag (<...>), or the sequence ==...==
  # This allows us to skip over tags entirely.
  post.output.gsub!(/(<[^>]+?>)|==([^=\s][^=]*?[^=\s])==/) do |match|
    if $1 # It was a tag
      match
    else # It was the highlight syntax
      content = $2
      "<mark>#{content}</mark>"
    end
  end
end
